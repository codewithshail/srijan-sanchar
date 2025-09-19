/**
 * Audio Cache Manager for TTS Performance Optimization
 * 
 * Provides intelligent caching for generated audio chunks to avoid regeneration
 * and optimize memory usage by properly disposing of audio buffers after playback.
 */

interface CacheEntry {
  audioData: ArrayBuffer;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  textHash: string;
  language: string;
  speaker: string;
  pitch: number;
  pace: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  memoryUsage: number;
}

export interface CacheOptions {
  maxEntries?: number;
  maxSizeBytes?: number;
  ttlMs?: number;
  cleanupIntervalMs?: number;
}

export class AudioCacheManager {
  private cache = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private readonly maxSizeBytes: number;
  private readonly ttlMs: number;
  private cleanupInterval?: NodeJS.Timeout;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0
  };

  constructor(options: CacheOptions = {}) {
    this.maxEntries = options.maxEntries || 100;
    this.maxSizeBytes = options.maxSizeBytes || 50 * 1024 * 1024; // 50MB default
    this.ttlMs = options.ttlMs || 30 * 60 * 1000; // 30 minutes default
    
    // Start cleanup interval
    const cleanupInterval = options.cleanupIntervalMs || 5 * 60 * 1000; // 5 minutes
    this.startCleanupInterval(cleanupInterval);
    
    console.log('[AUDIO_CACHE] Initialized with options:', {
      maxEntries: this.maxEntries,
      maxSizeBytes: this.maxSizeBytes,
      ttlMs: this.ttlMs,
      cleanupIntervalMs: cleanupInterval
    });
  }

  /**
   * Generate cache key from TTS parameters
   */
  private generateCacheKey(
    text: string,
    language: string,
    speaker: string,
    pitch: number,
    pace: number
  ): string {
    // Create a hash of the text content for consistent caching
    const textHash = this.hashString(text);
    return `${textHash}-${language}-${speaker}-${pitch}-${pace}`;
  }

  /**
   * Simple string hash function for cache keys
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get cached audio data if available
   */
  getCachedAudio(
    text: string,
    language: string,
    speaker: string,
    pitch: number,
    pace: number
  ): ArrayBuffer | null {
    const key = this.generateCacheKey(text, language, speaker, pitch, pace);
    const entry = this.cache.get(key);
    
    this.stats.totalRequests++;
    
    if (!entry) {
      this.stats.misses++;
      console.log('[AUDIO_CACHE] Cache miss for key:', key.substring(0, 20) + '...');
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      console.log('[AUDIO_CACHE] Cache entry expired for key:', key.substring(0, 20) + '...');
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    
    this.stats.hits++;
    console.log('[AUDIO_CACHE] Cache hit for key:', key.substring(0, 20) + '...', {
      accessCount: entry.accessCount,
      age: now - entry.timestamp
    });
    
    // Return a copy of the audio data to prevent buffer detachment issues
    return entry.audioData.slice(0);
  }

  /**
   * Store audio data in cache
   */
  setCachedAudio(
    text: string,
    language: string,
    speaker: string,
    pitch: number,
    pace: number,
    audioData: ArrayBuffer
  ): void {
    const key = this.generateCacheKey(text, language, speaker, pitch, pace);
    const now = Date.now();
    
    // Check if we need to make space
    this.ensureCapacity(audioData.byteLength);
    
    // Store a copy of the audio data
    const entry: CacheEntry = {
      audioData: audioData.slice(0),
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      textHash: this.hashString(text),
      language,
      speaker,
      pitch,
      pace
    };
    
    this.cache.set(key, entry);
    
    console.log('[AUDIO_CACHE] Cached audio for key:', key.substring(0, 20) + '...', {
      size: audioData.byteLength,
      totalEntries: this.cache.size,
      totalSize: this.getTotalSize()
    });
  }

  /**
   * Ensure cache has capacity for new entry
   */
  private ensureCapacity(newEntrySize: number): void {
    const currentSize = this.getTotalSize();
    
    // Check if we need to evict entries
    while (
      (this.cache.size >= this.maxEntries) ||
      (currentSize + newEntrySize > this.maxSizeBytes)
    ) {
      this.evictLeastRecentlyUsed();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLeastRecentlyUsed(): void {
    if (this.cache.size === 0) return;
    
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      this.stats.evictions++;
      
      console.log('[AUDIO_CACHE] Evicted LRU entry:', oldestKey.substring(0, 20) + '...', {
        age: Date.now() - oldestTime,
        accessCount: entry?.accessCount || 0,
        size: entry?.audioData.byteLength || 0
      });
    }
  }

  /**
   * Get total cache size in bytes
   */
  private getTotalSize(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.audioData.byteLength;
    }
    return totalSize;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, intervalMs);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        expiredKeys.push(key);
      }
    }
    
    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.stats.evictions++;
    }
    
    if (expiredKeys.length > 0) {
      console.log('[AUDIO_CACHE] Cleaned up expired entries:', {
        expiredCount: expiredKeys.length,
        remainingEntries: this.cache.size,
        totalSize: this.getTotalSize()
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalSize = this.getTotalSize();
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;
    
    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate,
      memoryUsage: totalSize / (1024 * 1024) // MB
    };
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    const entriesCleared = this.cache.size;
    const sizeCleared = this.getTotalSize();
    
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    };
    
    console.log('[AUDIO_CACHE] Cache cleared:', {
      entriesCleared,
      sizeCleared
    });
  }

  /**
   * Dispose of cache manager and cleanup resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    this.clear();
    console.log('[AUDIO_CACHE] Cache manager disposed');
  }

  /**
   * Preload audio for given text chunks (for progressive loading)
   */
  async preloadChunks(
    textChunks: string[],
    language: string,
    speaker: string,
    pitch: number,
    pace: number,
    generateAudioFn: (text: string) => Promise<ArrayBuffer>
  ): Promise<void> {
    console.log('[AUDIO_CACHE] Starting preload for', textChunks.length, 'chunks');
    
    const preloadPromises = textChunks.map(async (text, index) => {
      const cached = this.getCachedAudio(text, language, speaker, pitch, pace);
      if (!cached) {
        try {
          const audioData = await generateAudioFn(text);
          this.setCachedAudio(text, language, speaker, pitch, pace, audioData);
          console.log(`[AUDIO_CACHE] Preloaded chunk ${index + 1}/${textChunks.length}`);
        } catch (error) {
          console.error(`[AUDIO_CACHE] Failed to preload chunk ${index + 1}:`, error);
        }
      }
    });
    
    await Promise.allSettled(preloadPromises);
    console.log('[AUDIO_CACHE] Preload completed');
  }
}

// Global cache instance
let globalAudioCache: AudioCacheManager | null = null;

/**
 * Get or create global audio cache instance
 */
export function getAudioCache(options?: CacheOptions): AudioCacheManager {
  if (!globalAudioCache) {
    globalAudioCache = new AudioCacheManager(options);
  }
  return globalAudioCache;
}

/**
 * Dispose global cache instance
 */
export function disposeAudioCache(): void {
  if (globalAudioCache) {
    globalAudioCache.dispose();
    globalAudioCache = null;
  }
}