/**
 * Performance Optimization Modules for TTS Audio Streaming
 * 
 * This module provides comprehensive performance optimizations including:
 * - Intelligent caching for generated audio chunks
 * - Parallel processing for multiple text chunks
 * - Memory management for proper audio buffer disposal
 * - Progressive loading for faster initial response times
 */

// Audio Cache Manager
export {
  AudioCacheManager,
  getAudioCache,
  disposeAudioCache
} from './audio-cache-manager';

// Parallel Processing
export {
  ParallelProcessor,
  processInParallel
} from './parallel-processor';

// Memory Management
export {
  AudioMemoryManager,
  getMemoryManager,
  disposeMemoryManager
} from './memory-manager';

// Progressive Loading
export {
  ProgressiveLoader,
  loadProgressively
} from './progressive-loader';

// Type exports
export type {
  CacheStats,
  CacheOptions
} from './audio-cache-manager';

export type {
  ProcessingTask,
  ProcessingResult,
  ProcessorOptions
} from './parallel-processor';

export type {
  AudioBufferInfo,
  MemoryStats,
  MemoryManagerOptions
} from './memory-manager';

export type {
  LoadingChunk,
  ProgressiveLoadingOptions,
  LoadingProgress
} from './progressive-loader';