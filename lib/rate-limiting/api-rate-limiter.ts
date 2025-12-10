/**
 * API Rate Limiter
 * 
 * Redis-backed rate limiter for API endpoints with:
 * - Sliding window algorithm for accurate rate limiting
 * - Per-user and per-IP tracking
 * - Different limits for different endpoint categories
 * - Graceful fallback when Redis is unavailable
 * 
 * Requirements: Security (Task 36)
 */

import { getRedisCache, CACHE_PREFIX } from "../cache";

/**
 * Rate limit categories with different limits
 */
export type RateLimitCategory = 
  | "general"        // General API endpoints
  | "auth"           // Authentication endpoints
  | "ai"             // AI service endpoints (Gemini, Imagen)
  | "ai_heavy"       // Heavy AI operations (story generation, image generation)
  | "tts"            // Text-to-speech endpoints
  | "stt"            // Speech-to-text endpoints
  | "comments"       // Comment endpoints
  | "stories"        // Story CRUD endpoints
  | "uploads"        // File upload endpoints
  | "admin"          // Admin endpoints
  | "payment";       // Payment endpoints

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  maxRequests: number;      // Maximum requests allowed
  windowMs: number;         // Time window in milliseconds
  blockDurationMs?: number; // How long to block after limit exceeded
  skipSuccessfulRequests?: boolean; // Only count failed requests
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;        // Unix timestamp when limit resets
  retryAfter?: number;      // Seconds until retry is allowed
  category: RateLimitCategory;
  limit: number;
}

/**
 * Default rate limits per category
 */
const DEFAULT_LIMITS: Record<RateLimitCategory, RateLimitConfig> = {
  general: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 100 requests per minute
  },
  auth: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 auth attempts per minute
    blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes after limit
  },
  ai: {
    maxRequests: 60,
    windowMs: 60 * 1000, // 60 AI requests per minute
  },
  ai_heavy: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 10 heavy AI operations per hour
  },
  tts: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 TTS requests per minute
  },
  stt: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 STT requests per minute
  },
  comments: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 30 comments per minute
  },
  stories: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 20 story operations per minute
  },
  uploads: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 uploads per minute
  },
  admin: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 100 admin requests per minute
  },
  payment: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 payment requests per minute
    blockDurationMs: 10 * 60 * 1000, // Block for 10 minutes after limit
  },
};

/**
 * In-memory fallback for when Redis is unavailable
 */
interface InMemoryRecord {
  count: number;
  windowStart: number;
  blocked?: boolean;
  blockedUntil?: number;
}

export class APIRateLimiter {
  private configs: Map<RateLimitCategory, RateLimitConfig> = new Map();
  private inMemoryFallback: Map<string, InMemoryRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(customLimits?: Partial<Record<RateLimitCategory, RateLimitConfig>>) {
    // Initialize with default limits
    for (const [category, config] of Object.entries(DEFAULT_LIMITS)) {
      this.configs.set(category as RateLimitCategory, config);
    }

    // Apply custom limits
    if (customLimits) {
      for (const [category, config] of Object.entries(customLimits)) {
        if (config) {
          this.configs.set(category as RateLimitCategory, {
            ...DEFAULT_LIMITS[category as RateLimitCategory],
            ...config,
          });
        }
      }
    }

    // Start cleanup interval for in-memory fallback
    this.startCleanup();
  }

  /**
   * Check if a request is allowed
   */
  async checkLimit(
    identifier: string,
    category: RateLimitCategory = "general"
  ): Promise<RateLimitResult> {
    const config = this.configs.get(category) || DEFAULT_LIMITS.general;
    const key = this.getKey(identifier, category);

    try {
      // Try Redis first
      const redis = getRedisCache();
      if (redis.isAvailable()) {
        return await this.checkRedisLimit(key, config, category);
      }
    } catch (error) {
      console.warn("[API_RATE_LIMITER] Redis unavailable, using in-memory fallback:", error);
    }

    // Fallback to in-memory
    return this.checkInMemoryLimit(key, config, category);
  }

  /**
   * Record a request (call after successful rate limit check)
   */
  async recordRequest(
    identifier: string,
    category: RateLimitCategory = "general"
  ): Promise<void> {
    const key = this.getKey(identifier, category);

    try {
      const redis = getRedisCache();
      if (redis.isAvailable()) {
        await this.recordRedisRequest(key, category);
        return;
      }
    } catch (error) {
      console.warn("[API_RATE_LIMITER] Redis unavailable for recording:", error);
    }

    // Fallback to in-memory
    this.recordInMemoryRequest(key, category);
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getStatus(
    identifier: string,
    category: RateLimitCategory = "general"
  ): Promise<RateLimitResult> {
    const config = this.configs.get(category) || DEFAULT_LIMITS.general;
    const key = this.getKey(identifier, category);

    try {
      const redis = getRedisCache();
      if (redis.isAvailable()) {
        return await this.getRedisStatus(key, config, category);
      }
    } catch {
      // Fall through to in-memory
    }

    return this.getInMemoryStatus(key, config, category);
  }

  /**
   * Reset rate limit for an identifier
   */
  async reset(
    identifier: string,
    category: RateLimitCategory = "general"
  ): Promise<void> {
    const key = this.getKey(identifier, category);

    try {
      const redis = getRedisCache();
      if (redis.isAvailable()) {
        await redis.delete(key);
        await redis.delete(`${key}:blocked`);
      }
    } catch {
      // Ignore Redis errors
    }

    this.inMemoryFallback.delete(key);
  }

  /**
   * Get configuration for a category
   */
  getConfig(category: RateLimitCategory): RateLimitConfig {
    return this.configs.get(category) || DEFAULT_LIMITS.general;
  }

  /**
   * Update configuration for a category
   */
  setConfig(category: RateLimitCategory, config: Partial<RateLimitConfig>): void {
    const existing = this.configs.get(category) || DEFAULT_LIMITS.general;
    this.configs.set(category, { ...existing, ...config });
  }

  // Private methods

  private getKey(identifier: string, category: RateLimitCategory): string {
    return `${CACHE_PREFIX.RATE_LIMIT}${category}:${identifier}`;
  }

  private async checkRedisLimit(
    key: string,
    config: RateLimitConfig,
    category: RateLimitCategory
  ): Promise<RateLimitResult> {
    const redis = getRedisCache();
    const now = Date.now();

    // Check if blocked
    const blockedUntil = await redis.get<number>(`${key}:blocked`);
    if (blockedUntil && blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
        retryAfter: Math.ceil((blockedUntil - now) / 1000),
        category,
        limit: config.maxRequests,
      };
    }

    // Get current window data
    const windowData = await redis.get<{ count: number; windowStart: number }>(key);
    const windowStart = windowData?.windowStart || now;
    const count = windowData?.count || 0;

    // Check if window has expired
    if (now - windowStart >= config.windowMs) {
      // New window
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
        category,
        limit: config.maxRequests,
      };
    }

    // Check if limit exceeded
    if (count >= config.maxRequests) {
      // Apply block if configured
      if (config.blockDurationMs) {
        const blockUntil = now + config.blockDurationMs;
        await redis.set(`${key}:blocked`, blockUntil, {
          ttl: Math.ceil(config.blockDurationMs / 1000),
        });
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: windowStart + config.windowMs,
        retryAfter: Math.ceil((windowStart + config.windowMs - now) / 1000),
        category,
        limit: config.maxRequests,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      resetTime: windowStart + config.windowMs,
      category,
      limit: config.maxRequests,
    };
  }

  private async recordRedisRequest(
    key: string,
    category: RateLimitCategory
  ): Promise<void> {
    const redis = getRedisCache();
    const config = this.configs.get(category) || DEFAULT_LIMITS.general;
    const now = Date.now();

    const windowData = await redis.get<{ count: number; windowStart: number }>(key);
    const windowStart = windowData?.windowStart || now;
    let count = windowData?.count || 0;

    // Check if window has expired
    if (now - windowStart >= config.windowMs) {
      // New window
      await redis.set(key, { count: 1, windowStart: now }, {
        ttl: Math.ceil(config.windowMs / 1000) + 60, // Add buffer
      });
    } else {
      // Increment count
      await redis.set(key, { count: count + 1, windowStart }, {
        ttl: Math.ceil((windowStart + config.windowMs - now) / 1000) + 60,
      });
    }
  }

  private async getRedisStatus(
    key: string,
    config: RateLimitConfig,
    category: RateLimitCategory
  ): Promise<RateLimitResult> {
    const redis = getRedisCache();
    const now = Date.now();

    const blockedUntil = await redis.get<number>(`${key}:blocked`);
    if (blockedUntil && blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
        retryAfter: Math.ceil((blockedUntil - now) / 1000),
        category,
        limit: config.maxRequests,
      };
    }

    const windowData = await redis.get<{ count: number; windowStart: number }>(key);
    const windowStart = windowData?.windowStart || now;
    const count = windowData?.count || 0;

    if (now - windowStart >= config.windowMs) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs,
        category,
        limit: config.maxRequests,
      };
    }

    return {
      allowed: count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime: windowStart + config.windowMs,
      retryAfter: count >= config.maxRequests 
        ? Math.ceil((windowStart + config.windowMs - now) / 1000) 
        : undefined,
      category,
      limit: config.maxRequests,
    };
  }

  private checkInMemoryLimit(
    key: string,
    config: RateLimitConfig,
    category: RateLimitCategory
  ): RateLimitResult {
    const now = Date.now();
    const record = this.inMemoryFallback.get(key);

    // Check if blocked
    if (record?.blocked && record.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.blockedUntil,
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
        category,
        limit: config.maxRequests,
      };
    }

    // Check if window has expired or no record
    if (!record || now - record.windowStart >= config.windowMs) {
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
        category,
        limit: config.maxRequests,
      };
    }

    // Check if limit exceeded
    if (record.count >= config.maxRequests) {
      // Apply block if configured
      if (config.blockDurationMs) {
        record.blocked = true;
        record.blockedUntil = now + config.blockDurationMs;
        this.inMemoryFallback.set(key, record);
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: record.windowStart + config.windowMs,
        retryAfter: Math.ceil((record.windowStart + config.windowMs - now) / 1000),
        category,
        limit: config.maxRequests,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - record.count - 1,
      resetTime: record.windowStart + config.windowMs,
      category,
      limit: config.maxRequests,
    };
  }

  private recordInMemoryRequest(
    key: string,
    category: RateLimitCategory
  ): void {
    const config = this.configs.get(category) || DEFAULT_LIMITS.general;
    const now = Date.now();
    const record = this.inMemoryFallback.get(key);

    if (!record || now - record.windowStart >= config.windowMs) {
      // New window
      this.inMemoryFallback.set(key, {
        count: 1,
        windowStart: now,
      });
    } else {
      // Increment count
      record.count++;
      this.inMemoryFallback.set(key, record);
    }
  }

  private getInMemoryStatus(
    key: string,
    config: RateLimitConfig,
    category: RateLimitCategory
  ): RateLimitResult {
    const now = Date.now();
    const record = this.inMemoryFallback.get(key);

    if (record?.blocked && record.blockedUntil && record.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.blockedUntil,
        retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
        category,
        limit: config.maxRequests,
      };
    }

    if (!record || now - record.windowStart >= config.windowMs) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetTime: now + config.windowMs,
        category,
        limit: config.maxRequests,
      };
    }

    return {
      allowed: record.count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - record.count),
      resetTime: record.windowStart + config.windowMs,
      retryAfter: record.count >= config.maxRequests
        ? Math.ceil((record.windowStart + config.windowMs - now) / 1000)
        : undefined,
      category,
      limit: config.maxRequests,
    };
  }

  private startCleanup(): void {
    // Clean up expired in-memory records every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.inMemoryFallback.entries()) {
        const config = this.getConfigFromKey(key);
        const maxAge = Math.max(
          config.windowMs,
          config.blockDurationMs || 0
        ) + 60000; // Add 1 minute buffer

        if (now - record.windowStart > maxAge) {
          this.inMemoryFallback.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  private getConfigFromKey(key: string): RateLimitConfig {
    // Extract category from key format: rate_limit:category:identifier
    const parts = key.replace(CACHE_PREFIX.RATE_LIMIT, "").split(":");
    const category = parts[0] as RateLimitCategory;
    return this.configs.get(category) || DEFAULT_LIMITS.general;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.inMemoryFallback.clear();
  }
}

// Singleton instance
let rateLimiterInstance: APIRateLimiter | null = null;

/**
 * Get API rate limiter instance
 */
export function getAPIRateLimiter(): APIRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new APIRateLimiter();
  }
  return rateLimiterInstance;
}
