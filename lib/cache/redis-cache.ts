/**
 * Redis Cache Service
 * 
 * Provides server-side caching using Redis for:
 * - AI responses (translations, grammar improvements)
 * - Story metadata
 * - User session data
 * - Rate limiting data
 * 
 * Requirements: Performance optimization (Task 32)
 */

import Redis from "ioredis";

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  AI_RESPONSE: 60 * 60 * 24, // 24 hours for AI responses
  STORY_METADATA: 60 * 60, // 1 hour for story metadata
  USER_SESSION: 60 * 60 * 24 * 7, // 7 days for user sessions
  TRANSLATION: 60 * 60 * 24 * 30, // 30 days for translations
  GRAMMAR: 60 * 60 * 24 * 7, // 7 days for grammar improvements
  DESCRIPTION: 60 * 60 * 24 * 7, // 7 days for generated descriptions
  IMAGE_PROMPTS: 60 * 60 * 24 * 7, // 7 days for image prompts
  SHORT: 60 * 5, // 5 minutes for short-lived data
  MEDIUM: 60 * 30, // 30 minutes for medium-lived data
  LONG: 60 * 60 * 24, // 24 hours for long-lived data
} as const;

// Cache key prefixes for organization
export const CACHE_PREFIX = {
  AI_TRANSLATION: "ai:translation:",
  AI_GRAMMAR: "ai:grammar:",
  AI_REWRITE: "ai:rewrite:",
  AI_EXPAND: "ai:expand:",
  AI_DESCRIPTION: "ai:description:",
  AI_IMAGE_PROMPTS: "ai:image_prompts:",
  STORY: "story:",
  USER: "user:",
  ANALYTICS: "analytics:",
  RATE_LIMIT: "rate_limit:",
} as const;

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: string;
}

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

/**
 * Redis Cache Manager
 * Singleton class for managing Redis cache operations
 */
export class RedisCacheManager {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private connectionPromise: Promise<Redis | null> | null = null;
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor() {
    this.initializeClient();
  }

  /**
   * Initialize Redis client
   */
  private initializeClient(): void {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      console.warn("[REDIS_CACHE] REDIS_URL not configured. Caching disabled.");
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        retryStrategy: (times) => {
          // Retry with exponential backoff, max 3 seconds
          return Math.min(times * 100, 3000);
        },
      });

      this.client.on("connect", () => {
        console.log("[REDIS_CACHE] Connected to Redis");
        this.isConnected = true;
      });

      this.client.on("error", (error) => {
        console.error("[REDIS_CACHE] Redis error:", error.message);
        this.isConnected = false;
      });

      this.client.on("close", () => {
        console.log("[REDIS_CACHE] Redis connection closed");
        this.isConnected = false;
      });
    } catch (error) {
      console.error("[REDIS_CACHE] Failed to initialize Redis client:", error);
    }
  }


  /**
   * Ensure Redis connection is established
   */
  private async ensureConnection(): Promise<Redis | null> {
    if (!this.client) {
      return null;
    }

    if (this.isConnected) {
      return this.client;
    }

    if (this.connectionPromise) {
      try {
        return await this.connectionPromise;
      } catch {
        return null;
      }
    }

    this.connectionPromise = (async () => {
      try {
        await this.client!.connect();
        return this.client!;
      } catch (error) {
        console.error("[REDIS_CACHE] Connection failed:", (error as Error).message);
        return null;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.client !== null && this.isConnected;
  }

  /**
   * Generate cache key with prefix
   */
  private generateKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}${key}` : key;
  }

  /**
   * Generate hash for cache key from content
   */
  generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const client = await this.ensureConnection();
    if (!client) {
      this.stats.misses++;
      return null;
    }

    try {
      const cacheKey = this.generateKey(key, options?.prefix);
      const value = await client.get(cacheKey);

      if (value === null) {
        this.stats.misses++;
        console.log("[REDIS_CACHE] Cache miss:", cacheKey.substring(0, 50));
        return null;
      }

      this.stats.hits++;
      console.log("[REDIS_CACHE] Cache hit:", cacheKey.substring(0, 50));
      return JSON.parse(value) as T;
    } catch (error) {
      console.error("[REDIS_CACHE] Get error:", error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions
  ): Promise<boolean> {
    const client = await this.ensureConnection();
    if (!client) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key, options?.prefix);
      const ttl = options?.ttl || CACHE_TTL.MEDIUM;
      const serialized = JSON.stringify(value);

      await client.setex(cacheKey, ttl, serialized);
      console.log("[REDIS_CACHE] Cached:", cacheKey.substring(0, 50), `TTL: ${ttl}s`);
      return true;
    } catch (error) {
      console.error("[REDIS_CACHE] Set error:", error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    const client = await this.ensureConnection();
    if (!client) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key, options?.prefix);
      await client.del(cacheKey);
      console.log("[REDIS_CACHE] Deleted:", cacheKey);
      return true;
    } catch (error) {
      console.error("[REDIS_CACHE] Delete error:", error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    const client = await this.ensureConnection();
    if (!client) {
      return 0;
    }

    try {
      const keys = await client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await client.del(...keys);
      console.log("[REDIS_CACHE] Deleted by pattern:", pattern, `Count: ${deleted}`);
      return deleted;
    } catch (error) {
      console.error("[REDIS_CACHE] Delete by pattern error:", error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    const client = await this.ensureConnection();
    if (!client) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key, options?.prefix);
      const exists = await client.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      console.error("[REDIS_CACHE] Exists error:", error);
      return false;
    }
  }

  /**
   * Get or set value with callback
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const value = await fetchFn();

    // Cache the result
    await this.set(key, value, options);

    return value;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const client = await this.ensureConnection();
    
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;

    let totalKeys = 0;
    let memoryUsage = "N/A";

    if (client) {
      try {
        totalKeys = await client.dbsize();
        const info = await client.info("memory");
        const match = info.match(/used_memory_human:(\S+)/);
        if (match) {
          memoryUsage = match[1];
        }
      } catch (error) {
        console.error("[REDIS_CACHE] Stats error:", error);
      }
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalKeys,
      memoryUsage,
    };
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    const client = await this.ensureConnection();
    if (!client) {
      return false;
    }

    try {
      await client.flushdb();
      this.stats = { hits: 0, misses: 0 };
      console.log("[REDIS_CACHE] Cache cleared");
      return true;
    } catch (error) {
      console.error("[REDIS_CACHE] Clear error:", error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      console.log("[REDIS_CACHE] Connection closed");
    }
  }
}

// Singleton instance
let redisCacheInstance: RedisCacheManager | null = null;

/**
 * Get Redis cache instance
 */
export function getRedisCache(): RedisCacheManager {
  if (!redisCacheInstance) {
    redisCacheInstance = new RedisCacheManager();
  }
  return redisCacheInstance;
}

/**
 * Dispose Redis cache instance
 */
export async function disposeRedisCache(): Promise<void> {
  if (redisCacheInstance) {
    await redisCacheInstance.close();
    redisCacheInstance = null;
  }
}
