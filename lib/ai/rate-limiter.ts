/**
 * Rate limiter for AI services
 * Implements token bucket algorithm with per-service limits
 * 
 * Note: This is the AI-specific rate limiter. For general API rate limiting,
 * see lib/rate-limiting/api-rate-limiter.ts
 * 
 * Requirements: 5.2, 5.3, 6.2, 8.1, 11.1, 11.2 (AI Services)
 * Requirements: Security (Task 36)
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  maxTokens?: number;
}

interface RequestRecord {
  timestamp: number;
  tokens?: number;
}

export interface AIRateLimitStatus {
  service: string;
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Default rate limits for different AI services
    // These are per-service limits, separate from per-user API limits
    this.configs.set('gemini', {
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute - 100 requests/min
    });

    this.configs.set('imagen', {
      maxRequests: 20,
      windowMs: 60 * 1000, // 1 minute - 20 images/min
    });

    this.configs.set('stt', {
      maxRequests: 50,
      windowMs: 60 * 1000, // 1 minute - 50 transcriptions/min
    });

    this.configs.set('tts', {
      maxRequests: 50,
      windowMs: 60 * 1000, // 1 minute - 50 audio generations/min
    });
  }

  /**
   * Check if a request is allowed
   */
  async checkLimit(service: string, userId?: string): Promise<boolean> {
    const key = this.getKey(service, userId);
    const config = this.configs.get(service);

    if (!config) {
      console.warn(`[RATE_LIMITER] No config for service: ${service}`);
      return true;
    }

    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside the window
    const validRequests = requests.filter(
      (req) => now - req.timestamp < config.windowMs
    );

    if (validRequests.length >= config.maxRequests) {
      const oldestRequest = validRequests[0];
      const resetTime = oldestRequest.timestamp + config.windowMs;
      console.warn(
        `[RATE_LIMITER] Rate limit exceeded for ${service}. Resets in ${
          Math.ceil((resetTime - now) / 1000)
        }s`
      );
      return false;
    }

    return true;
  }

  /**
   * Record a request
   */
  async recordRequest(service: string, userId?: string): Promise<void> {
    const key = this.getKey(service, userId);
    const requests = this.requests.get(key) || [];
    
    requests.push({
      timestamp: Date.now(),
    });

    this.requests.set(key, requests);
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(service: string, userId?: string): number {
    const key = this.getKey(service, userId);
    const config = this.configs.get(service);

    if (!config) return Infinity;

    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(
      (req) => now - req.timestamp < config.windowMs
    );

    return Math.max(0, config.maxRequests - validRequests.length);
  }

  /**
   * Get time until rate limit resets
   */
  getResetTime(service: string, userId?: string): number {
    const key = this.getKey(service, userId);
    const config = this.configs.get(service);

    if (!config) return 0;

    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(
      (req) => now - req.timestamp < config.windowMs
    );

    if (validRequests.length === 0) return 0;

    const oldestRequest = validRequests[0];
    return Math.max(0, oldestRequest.timestamp + config.windowMs - now);
  }

  /**
   * Clear rate limit for a service/user
   */
  clear(service: string, userId?: string): void {
    const key = this.getKey(service, userId);
    this.requests.delete(key);
  }

  /**
   * Get full status for a service
   */
  getStatus(service: string, userId?: string): AIRateLimitStatus {
    const key = this.getKey(service, userId);
    const config = this.configs.get(service);

    if (!config) {
      return {
        service,
        allowed: true,
        remaining: Infinity,
        resetTime: 0,
      };
    }

    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(
      (req) => now - req.timestamp < config.windowMs
    );

    const remaining = Math.max(0, config.maxRequests - validRequests.length);
    const allowed = remaining > 0;
    
    let resetTime = now + config.windowMs;
    let retryAfter: number | undefined;

    if (validRequests.length > 0) {
      const oldestRequest = validRequests[0];
      resetTime = oldestRequest.timestamp + config.windowMs;
      
      if (!allowed) {
        retryAfter = Math.ceil((resetTime - now) / 1000);
      }
    }

    return {
      service,
      allowed,
      remaining,
      resetTime,
      retryAfter,
    };
  }

  /**
   * Get all service statuses
   */
  getAllStatuses(): AIRateLimitStatus[] {
    const services = ['gemini', 'imagen', 'stt', 'tts'];
    return services.map(service => this.getStatus(service));
  }

  /**
   * Update configuration for a service
   */
  setConfig(service: string, config: Partial<RateLimitConfig>): void {
    const existing = this.configs.get(service) || {
      maxRequests: 100,
      windowMs: 60 * 1000,
    };
    this.configs.set(service, { ...existing, ...config });
  }

  /**
   * Get configuration for a service
   */
  getConfig(service: string): RateLimitConfig | undefined {
    return this.configs.get(service);
  }

  private getKey(service: string, userId?: string): string {
    return userId ? `${service}:${userId}` : service;
  }
}

export const rateLimiter = new RateLimiter();

// Re-export types for convenience
export type { RateLimitConfig };
