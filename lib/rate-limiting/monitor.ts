/**
 * Rate Limit Monitor
 * 
 * Provides monitoring and statistics for rate limiting:
 * - Track rate limit events
 * - Generate statistics and reports
 * - Identify abuse patterns
 * 
 * Requirements: Security (Task 36)
 */

import { getRedisCache, CACHE_PREFIX } from "../cache";
import { type RateLimitCategory } from "./api-rate-limiter";

/**
 * Rate limit event
 */
export interface RateLimitEvent {
  identifier: string;
  category: RateLimitCategory;
  allowed: boolean;
  remaining: number;
  timestamp: number;
  path?: string;
  method?: string;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  blockRate: number;
  byCategory: Record<RateLimitCategory, {
    total: number;
    allowed: number;
    blocked: number;
  }>;
  topBlockedIdentifiers: Array<{
    identifier: string;
    count: number;
    lastBlocked: number;
  }>;
  recentEvents: RateLimitEvent[];
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * Rate Limit Monitor
 */
export class RateLimitMonitor {
  private events: RateLimitEvent[] = [];
  private maxEvents = 1000;
  private blockedCounts: Map<string, { count: number; lastBlocked: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Record a rate limit event
   */
  recordEvent(event: RateLimitEvent): void {
    this.events.push(event);

    // Track blocked requests
    if (!event.allowed) {
      const existing = this.blockedCounts.get(event.identifier) || { count: 0, lastBlocked: 0 };
      this.blockedCounts.set(event.identifier, {
        count: existing.count + 1,
        lastBlocked: event.timestamp,
      });
    }

    // Trim events if needed
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Also persist to Redis for cross-instance monitoring
    this.persistEvent(event).catch(console.error);
  }

  /**
   * Get statistics for a time range
   */
  getStats(timeRangeMs: number = 60 * 60 * 1000): RateLimitStats {
    const now = Date.now();
    const startTime = now - timeRangeMs;

    const recentEvents = this.events.filter(e => e.timestamp >= startTime);

    const byCategory: RateLimitStats["byCategory"] = {} as RateLimitStats["byCategory"];
    let totalRequests = 0;
    let allowedRequests = 0;
    let blockedRequests = 0;

    for (const event of recentEvents) {
      totalRequests++;
      if (event.allowed) {
        allowedRequests++;
      } else {
        blockedRequests++;
      }

      if (!byCategory[event.category]) {
        byCategory[event.category] = { total: 0, allowed: 0, blocked: 0 };
      }
      byCategory[event.category].total++;
      if (event.allowed) {
        byCategory[event.category].allowed++;
      } else {
        byCategory[event.category].blocked++;
      }
    }

    // Get top blocked identifiers
    const topBlockedIdentifiers = Array.from(this.blockedCounts.entries())
      .filter(([, data]) => data.lastBlocked >= startTime)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([identifier, data]) => ({
        identifier: this.maskIdentifier(identifier),
        count: data.count,
        lastBlocked: data.lastBlocked,
      }));

    return {
      totalRequests,
      allowedRequests,
      blockedRequests,
      blockRate: totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0,
      byCategory,
      topBlockedIdentifiers,
      recentEvents: recentEvents.slice(-50).map(e => ({
        ...e,
        identifier: this.maskIdentifier(e.identifier),
      })),
      timeRange: {
        start: startTime,
        end: now,
      },
    };
  }

  /**
   * Get real-time stats summary
   */
  getRealTimeStats(): {
    requestsPerMinute: number;
    blockedPerMinute: number;
    currentBlockRate: number;
    activeCategories: RateLimitCategory[];
  } {
    const oneMinuteAgo = Date.now() - 60 * 1000;
    const recentEvents = this.events.filter(e => e.timestamp >= oneMinuteAgo);

    const requestsPerMinute = recentEvents.length;
    const blockedPerMinute = recentEvents.filter(e => !e.allowed).length;
    const currentBlockRate = requestsPerMinute > 0 
      ? (blockedPerMinute / requestsPerMinute) * 100 
      : 0;

    const activeCategories = [...new Set(recentEvents.map(e => e.category))];

    return {
      requestsPerMinute,
      blockedPerMinute,
      currentBlockRate,
      activeCategories,
    };
  }

  /**
   * Check if an identifier appears to be abusing the system
   */
  isAbusive(identifier: string, threshold: number = 10): boolean {
    const data = this.blockedCounts.get(identifier);
    if (!data) return false;

    // Check if blocked more than threshold times in the last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    if (data.lastBlocked < oneHourAgo) {
      return false;
    }

    return data.count >= threshold;
  }

  /**
   * Get abuse report for an identifier
   */
  getAbuseReport(identifier: string): {
    isAbusive: boolean;
    blockedCount: number;
    lastBlocked: number | null;
    recentEvents: RateLimitEvent[];
  } {
    const data = this.blockedCounts.get(identifier);
    const recentEvents = this.events
      .filter(e => e.identifier === identifier)
      .slice(-20);

    return {
      isAbusive: this.isAbusive(identifier),
      blockedCount: data?.count || 0,
      lastBlocked: data?.lastBlocked || null,
      recentEvents,
    };
  }

  /**
   * Clear statistics
   */
  clear(): void {
    this.events = [];
    this.blockedCounts.clear();
  }

  /**
   * Clear old data
   */
  clearOld(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    
    this.events = this.events.filter(e => e.timestamp >= cutoff);
    
    for (const [identifier, data] of this.blockedCounts.entries()) {
      if (data.lastBlocked < cutoff) {
        this.blockedCounts.delete(identifier);
      }
    }
  }

  // Private methods

  private maskIdentifier(identifier: string): string {
    // Mask IP addresses and user IDs for privacy
    if (identifier.startsWith("ip:")) {
      const ip = identifier.substring(3);
      const parts = ip.split(".");
      if (parts.length === 4) {
        return `ip:${parts[0]}.${parts[1]}.***.***`;
      }
      return `ip:***`;
    }

    if (identifier.startsWith("user:")) {
      const userId = identifier.substring(5);
      if (userId.length > 8) {
        return `user:${userId.substring(0, 4)}...${userId.substring(userId.length - 4)}`;
      }
      return `user:***`;
    }

    return identifier.substring(0, 10) + "...";
  }

  private async persistEvent(event: RateLimitEvent): Promise<void> {
    try {
      const redis = getRedisCache();
      if (!redis.isAvailable()) return;

      // Store aggregated stats in Redis
      const hourKey = `${CACHE_PREFIX.RATE_LIMIT}stats:${Math.floor(event.timestamp / 3600000)}`;
      
      const stats = await redis.get<{
        total: number;
        blocked: number;
        byCategory: Record<string, { total: number; blocked: number }>;
      }>(hourKey) || {
        total: 0,
        blocked: 0,
        byCategory: {},
      };

      stats.total++;
      if (!event.allowed) {
        stats.blocked++;
      }

      if (!stats.byCategory[event.category]) {
        stats.byCategory[event.category] = { total: 0, blocked: 0 };
      }
      stats.byCategory[event.category].total++;
      if (!event.allowed) {
        stats.byCategory[event.category].blocked++;
      }

      await redis.set(hourKey, stats, { ttl: 24 * 60 * 60 }); // Keep for 24 hours
    } catch (error) {
      // Silently fail - monitoring shouldn't break the app
      console.warn("[RATE_LIMIT_MONITOR] Failed to persist event:", error);
    }
  }

  private startCleanup(): void {
    // Clean up old data every hour
    this.cleanupInterval = setInterval(() => {
      this.clearOld();
    }, 60 * 60 * 1000);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Singleton instance
let monitorInstance: RateLimitMonitor | null = null;

/**
 * Get rate limit monitor instance
 */
export function getRateLimitMonitor(): RateLimitMonitor {
  if (!monitorInstance) {
    monitorInstance = new RateLimitMonitor();
  }
  return monitorInstance;
}
