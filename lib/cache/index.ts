/**
 * Caching Module Index
 * 
 * Provides unified access to all caching utilities:
 * - Redis server-side caching
 * - AI response caching
 * - Browser caching (localStorage, sessionStorage)
 * - IndexedDB for audio chapters (see lib/audio/audio-language-cache.ts)
 * 
 * Requirements: Performance optimization (Task 32)
 */

// Import all modules first
import {
  RedisCacheManager,
  getRedisCache as getRedis,
  disposeRedisCache,
  CACHE_TTL,
  CACHE_PREFIX,
  type CacheStats,
  type CacheOptions,
} from "./redis-cache";

import {
  AIResponseCache,
  getAIResponseCache as getAICache,
  type AIResponseCacheKey,
  type CachedAIResponse,
} from "./ai-response-cache";

import {
  BrowserCacheManager,
  getBrowserCache as getBrowser,
  STORAGE_KEYS,
  BROWSER_CACHE_TTL,
  draftStorage,
  playbackStorage,
  preferencesStorage,
  recentStoriesStorage,
} from "./browser-cache";

import {
  AudioLanguageCache,
  getAudioLanguageCache as getAudioCache,
  disposeAudioLanguageCache,
  type CachedAudioChapter,
  type AudioCacheMetadata,
} from "../audio/audio-language-cache";

// Re-export everything
export {
  // Redis Cache
  RedisCacheManager,
  disposeRedisCache,
  CACHE_TTL,
  CACHE_PREFIX,
  type CacheStats,
  type CacheOptions,
  
  // AI Response Cache
  AIResponseCache,
  type AIResponseCacheKey,
  type CachedAIResponse,
  
  // Browser Cache
  BrowserCacheManager,
  STORAGE_KEYS,
  BROWSER_CACHE_TTL,
  draftStorage,
  playbackStorage,
  preferencesStorage,
  recentStoriesStorage,
  
  // Audio Cache
  AudioLanguageCache,
  disposeAudioLanguageCache,
  type CachedAudioChapter,
  type AudioCacheMetadata,
};

// Export getter functions with original names
export const getRedisCache = getRedis;
export const getAIResponseCache = getAICache;
export const getBrowserCache = getBrowser;
export const getAudioLanguageCache = getAudioCache;

/**
 * Cache Manager - Unified interface for all caching operations
 */
export class CacheManager {
  private static instance: CacheManager | null = null;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get Redis cache for server-side operations
   */
  getServerCache() {
    return getRedis();
  }

  /**
   * Get AI response cache
   */
  getAICache() {
    return getAICache();
  }

  /**
   * Get browser cache for client-side operations
   */
  getBrowserCache() {
    return getBrowser();
  }

  /**
   * Get audio language cache (IndexedDB)
   */
  getAudioCache() {
    return getAudioCache();
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    // Clear Redis cache
    const redis = getRedis();
    await redis.clear();

    // Clear browser cache
    const browser = getBrowser();
    browser.clearExpired();

    // Clear audio cache
    const audio = getAudioCache();
    await audio.clearExpiredCaches();

    console.log("[CACHE_MANAGER] All caches cleared");
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    redis: CacheStats | null;
    browser: { used: number; available: number; percentage: number };
    audio: { size: number };
  }> {
    const redis = getRedis();
    const browser = getBrowser();
    const audio = getAudioCache();

    let redisStats: CacheStats | null = null;
    try {
      redisStats = await redis.getStats();
    } catch {
      // Redis not available
    }

    const browserStats = browser.getStorageInfo();
    
    let audioSize = 0;
    try {
      audioSize = await audio.getCacheSize();
    } catch {
      // IndexedDB not available
    }

    return {
      redis: redisStats,
      browser: browserStats,
      audio: { size: audioSize },
    };
  }
}

/**
 * Get cache manager instance
 */
export function getCacheManager(): CacheManager {
  return CacheManager.getInstance();
}
