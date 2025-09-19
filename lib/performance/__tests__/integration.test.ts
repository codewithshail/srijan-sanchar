/**
 * Integration tests for performance optimizations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioCacheManager } from '../audio-cache-manager';
import { ParallelProcessor } from '../parallel-processor';
import { AudioMemoryManager } from '../memory-manager';
import { ProgressiveLoader } from '../progressive-loader';

describe('Performance Optimizations Integration', () => {
  let cacheManager: AudioCacheManager;
  let memoryManager: AudioMemoryManager;
  let mockAudioData: ArrayBuffer;

  beforeEach(() => {
    cacheManager = new AudioCacheManager({
      maxEntries: 10,
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      ttlMs: 10000 // 10 seconds
    });

    memoryManager = new AudioMemoryManager({
      maxBuffers: 20,
      maxMemoryMB: 10,
      bufferTtlMs: 15000 // 15 seconds
    });

    // Create mock audio data
    mockAudioData = new ArrayBuffer(2048);
    const view = new Uint8Array(mockAudioData);
    for (let i = 0; i < view.length; i++) {
      view[i] = i % 256;
    }
  });

  afterEach(() => {
    cacheManager.dispose();
    memoryManager.dispose();
  });

  describe('Cache and Memory Integration', () => {
    it('should work together for optimal memory usage', () => {
      const text = 'Test audio content';
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Cache audio
      cacheManager.setCachedAudio(text, language, speaker, pitch, pace, mockAudioData);

      // Register with memory manager
      const bufferId = 'test-buffer-1';
      memoryManager.registerBuffer(bufferId, mockAudioData, {
        chunkIndex: 0,
        duration: 5.0
      });

      // Verify cache hit
      const cachedAudio = cacheManager.getCachedAudio(text, language, speaker, pitch, pace);
      expect(cachedAudio).not.toBeNull();
      expect(cachedAudio!.byteLength).toBe(mockAudioData.byteLength);

      // Verify memory management
      const memoryStats = memoryManager.getStats();
      expect(memoryStats.totalBuffers).toBe(1);
      expect(memoryStats.activeBuffers).toBe(1);

      // Mark buffer as inactive
      memoryManager.markBufferInactive(bufferId);
      const updatedStats = memoryManager.getStats();
      expect(updatedStats.activeBuffers).toBe(0);

      // Dispose inactive buffers
      const disposedCount = memoryManager.disposeInactiveBuffers();
      expect(disposedCount).toBe(1);
    });

    it('should handle cache statistics correctly', () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Cache multiple items
      texts.forEach((text, index) => {
        const audioData = new ArrayBuffer(1024 * (index + 1));
        cacheManager.setCachedAudio(text, language, speaker, pitch, pace, audioData);
      });

      // Access some items (hits)
      cacheManager.getCachedAudio(texts[0], language, speaker, pitch, pace);
      cacheManager.getCachedAudio(texts[1], language, speaker, pitch, pace);

      // Try to access non-existent item (miss)
      cacheManager.getCachedAudio('Non-existent', language, speaker, pitch, pace);

      const stats = cacheManager.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.hitRate).toBeLessThan(100);
    });
  });

  describe('Parallel Processing Integration', () => {
    it('should process multiple items efficiently', async () => {
      const items = ['chunk1', 'chunk2', 'chunk3', 'chunk4'];
      const processor = new ParallelProcessor<string, ArrayBuffer>({
        maxConcurrency: 2,
        retryAttempts: 1,
        progressiveThreshold: 2
      });

      const processFn = vi.fn().mockImplementation(async (item: string, index: number) => {
        // Simulate TTS processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const audioData = new ArrayBuffer(1024);
        const view = new Uint8Array(audioData);
        view.fill(index); // Fill with index for identification
        
        return audioData;
      });

      const progressCallback = vi.fn();
      const progressiveCallback = vi.fn();

      const results = await processor.processParallel(items, processFn, {
        onProgress: progressCallback,
        onProgressiveReady: progressiveCallback
      });

      expect(results).toHaveLength(4);
      expect(results.every(r => !r.error && r.result)).toBe(true);
      expect(processFn).toHaveBeenCalledTimes(4);
      expect(progressCallback).toHaveBeenCalled();
      expect(progressiveCallback).toHaveBeenCalled();

      // Verify results are in correct order
      results.forEach((result, index) => {
        expect(result.index).toBe(index);
        expect(result.result).toBeDefined();
      });
    });
  });

  describe('Progressive Loading Integration', () => {
    it('should load chunks progressively', async () => {
      const textChunks = ['Chunk 1', 'Chunk 2', 'Chunk 3', 'Chunk 4'];
      const loader = new ProgressiveLoader({
        initialChunkCount: 2,
        maxConcurrentLoads: 2,
        preloadAhead: 1
      });

      const loadFn = vi.fn().mockImplementation(async (text: string, index: number) => {
        // Simulate audio generation
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const audioData = new ArrayBuffer(512);
        const view = new Uint8Array(audioData);
        view.fill(index + 1); // Fill with index+1 for identification
        
        return audioData;
      });

      const progressCallback = vi.fn();
      const readyCallback = vi.fn();
      const chunkLoadedCallback = vi.fn();

      await loader.startLoading(textChunks, loadFn, {
        onProgress: progressCallback,
        onReadyForPlayback: readyCallback,
        onChunkLoaded: chunkLoadedCallback
      });

      // Wait for all chunks to load
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(loadFn).toHaveBeenCalledTimes(4);
      expect(progressCallback).toHaveBeenCalled();
      expect(readyCallback).toHaveBeenCalled();
      expect(chunkLoadedCallback).toHaveBeenCalledTimes(4);

      // Verify all chunks are loaded
      const loadedChunks = loader.getLoadedChunks();
      expect(loadedChunks).toHaveLength(4);
      
      // Verify chunks are in correct order
      loadedChunks.forEach((chunk, index) => {
        const view = new Uint8Array(chunk);
        expect(view[0]).toBe(index + 1); // Should match our fill pattern
      });
    });
  });

  describe('End-to-End Performance Optimization', () => {
    it('should demonstrate complete optimization workflow', async () => {
      const textChunks = ['Hello world', 'How are you', 'This is a test'];
      const language = 'en-US';
      const speaker = 'default';
      const pitch = 0;
      const pace = 1;

      // Step 1: Check cache for existing audio
      let cachedResults = textChunks.map(text => 
        cacheManager.getCachedAudio(text, language, speaker, pitch, pace)
      );
      
      // Initially, nothing should be cached
      expect(cachedResults.every(result => result === null)).toBe(true);

      // Step 2: Process chunks in parallel
      const processor = new ParallelProcessor<string, ArrayBuffer>({
        maxConcurrency: 2,
        retryAttempts: 1,
        progressiveThreshold: 1
      });

      const processFn = async (text: string, index: number) => {
        // Simulate TTS generation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const audioData = new ArrayBuffer(1024);
        const view = new Uint8Array(audioData);
        view.fill(text.charCodeAt(0)); // Use first char for identification
        
        // Cache the result
        cacheManager.setCachedAudio(text, language, speaker, pitch, pace, audioData);
        
        // Register with memory manager
        const bufferId = `buffer-${index}-${Date.now()}`;
        memoryManager.registerBuffer(bufferId, audioData, {
          chunkIndex: index,
          duration: 2.0
        });
        
        return audioData;
      };

      const results = await processor.processParallel(textChunks, processFn);

      // Step 3: Verify all chunks were processed successfully
      expect(results).toHaveLength(3);
      expect(results.every(r => !r.error && r.result)).toBe(true);

      // Step 4: Verify caching worked
      cachedResults = textChunks.map(text => 
        cacheManager.getCachedAudio(text, language, speaker, pitch, pace)
      );
      expect(cachedResults.every(result => result !== null)).toBe(true);

      // Step 5: Verify memory management
      const memoryStats = memoryManager.getStats();
      expect(memoryStats.totalBuffers).toBe(3);
      expect(memoryStats.activeBuffers).toBe(3);

      // Step 6: Verify cache statistics
      const cacheStats = cacheManager.getStats();
      expect(cacheStats.totalEntries).toBe(3);
      expect(cacheStats.hitRate).toBeGreaterThan(0); // Should have hits from our getCachedAudio calls

      // Step 7: Test cache hit on subsequent request
      const cachedAudio = cacheManager.getCachedAudio(textChunks[0], language, speaker, pitch, pace);
      expect(cachedAudio).not.toBeNull();
      
      const finalCacheStats = cacheManager.getStats();
      expect(finalCacheStats.hitRate).toBeGreaterThan(cacheStats.hitRate);
    });
  });
});