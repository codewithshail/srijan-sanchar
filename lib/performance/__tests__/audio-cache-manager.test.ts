/**
 * Tests for Audio Cache Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioCacheManager } from '../audio-cache-manager';

describe('AudioCacheManager', () => {
  let cacheManager: AudioCacheManager;
  let mockAudioData: ArrayBuffer;

  beforeEach(() => {
    cacheManager = new AudioCacheManager({
      maxEntries: 5,
      maxSizeBytes: 1024 * 1024, // 1MB
      ttlMs: 5000, // 5 seconds for testing
      cleanupIntervalMs: 1000 // 1 second for testing
    });

    // Create mock audio data
    mockAudioData = new ArrayBuffer(1024);
    const view = new Uint8Array(mockAudioData);
    for (let i = 0; i < view.length; i++) {
      view[i] = i % 256;
    }
  });

  afterEach(() => {
    cacheManager.dispose();
  });

  describe('Basic Caching', () => {
    it('should cache and retrieve audio data', () => {
      const text = 'Hello world';
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Cache audio
      cacheManager.setCachedAudio(text, language, speaker, pitch, pace, mockAudioData);

      // Retrieve audio
      const retrieved = cacheManager.getCachedAudio(text, language, speaker, pitch, pace);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.byteLength).toBe(mockAudioData.byteLength);
    });

    it('should return null for non-existent cache entries', () => {
      const retrieved = cacheManager.getCachedAudio('nonexistent', 'en-US', 'default', 0, 1);
      expect(retrieved).toBeNull();
    });

    it('should handle different cache keys correctly', () => {
      const text1 = 'Hello world';
      const text2 = 'Goodbye world';
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Cache different texts
      cacheManager.setCachedAudio(text1, language, speaker, pitch, pace, mockAudioData);
      cacheManager.setCachedAudio(text2, language, speaker, pitch, pace, mockAudioData);

      // Should retrieve correct data for each
      const retrieved1 = cacheManager.getCachedAudio(text1, language, speaker, pitch, pace);
      const retrieved2 = cacheManager.getCachedAudio(text2, language, speaker, pitch, pace);

      expect(retrieved1).not.toBeNull();
      expect(retrieved2).not.toBeNull();
    });
  });

  describe('Cache Eviction', () => {
    it('should evict entries when max entries exceeded', () => {
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Fill cache beyond capacity
      for (let i = 0; i < 7; i++) {
        cacheManager.setCachedAudio(`text${i}`, language, speaker, pitch, pace, mockAudioData);
      }

      const stats = cacheManager.getStats();
      expect(stats.totalEntries).toBeLessThanOrEqual(5);
    });

    it('should evict least recently used entries', () => {
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        cacheManager.setCachedAudio(`text${i}`, language, speaker, pitch, pace, mockAudioData);
      }

      // Access some entries to update their LRU status
      cacheManager.getCachedAudio('text2', language, speaker, pitch, pace);
      cacheManager.getCachedAudio('text4', language, speaker, pitch, pace);

      // Add one more entry to trigger eviction
      cacheManager.setCachedAudio('text5', language, speaker, pitch, pace, mockAudioData);

      // The least recently used entries should be evicted
      const retrieved0 = cacheManager.getCachedAudio('text0', language, speaker, pitch, pace);
      const retrieved2 = cacheManager.getCachedAudio('text2', language, speaker, pitch, pace);
      const retrieved4 = cacheManager.getCachedAudio('text4', language, speaker, pitch, pace);

      expect(retrieved0).toBeNull(); // Should be evicted
      expect(retrieved2).not.toBeNull(); // Should still exist (accessed recently)
      expect(retrieved4).not.toBeNull(); // Should still exist (accessed recently)
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      const text = 'Hello world';
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Cache audio
      cacheManager.setCachedAudio(text, language, speaker, pitch, pace, mockAudioData);

      // Should be available immediately
      let retrieved = cacheManager.getCachedAudio(text, language, speaker, pitch, pace);
      expect(retrieved).not.toBeNull();

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Should be expired now
      retrieved = cacheManager.getCachedAudio(text, language, speaker, pitch, pace);
      expect(retrieved).toBeNull();
    }, 10000); // Increase timeout to 10 seconds
  });

  describe('Statistics', () => {
    it('should track cache statistics correctly', () => {
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Add some entries
      cacheManager.setCachedAudio('text1', language, speaker, pitch, pace, mockAudioData);
      cacheManager.setCachedAudio('text2', language, speaker, pitch, pace, mockAudioData);

      // Access one entry (hit)
      cacheManager.getCachedAudio('text1', language, speaker, pitch, pace);

      // Try to access non-existent entry (miss)
      cacheManager.getCachedAudio('nonexistent', language, speaker, pitch, pace);

      const stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should clear all entries', () => {
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Add some entries
      cacheManager.setCachedAudio('text1', language, speaker, pitch, pace, mockAudioData);
      cacheManager.setCachedAudio('text2', language, speaker, pitch, pace, mockAudioData);

      let stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(2);

      // Clear cache
      cacheManager.clear();

      stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('should handle buffer detachment correctly', () => {
      const text = 'Hello world';
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Cache audio
      cacheManager.setCachedAudio(text, language, speaker, pitch, pace, mockAudioData);

      // Retrieve multiple times to ensure copies are returned
      const retrieved1 = cacheManager.getCachedAudio(text, language, speaker, pitch, pace);
      const retrieved2 = cacheManager.getCachedAudio(text, language, speaker, pitch, pace);

      expect(retrieved1).not.toBeNull();
      expect(retrieved2).not.toBeNull();
      expect(retrieved1).not.toBe(retrieved2); // Should be different instances
    });
  });
});