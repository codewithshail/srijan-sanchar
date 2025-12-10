/**
 * Audio Module Exports
 * 
 * Provides audio-related functionality including:
 * - Audio chapter generation and management
 * - WAV file chunk management
 * - Multi-language audio caching
 * - Audio streaming with range requests
 * - Audio file optimization
 */

export {
  audioChapterService,
  AudioChapterService,
  type AudioChapterConfig,
  type TextChapter,
  type GeneratedAudioChapter,
  type AudioGenerationResult,
} from "./audio-chapter-service";

export {
  WAVAudioChunkManager,
  createWAVAudioChunkManager,
  type AudioChunkManager,
  type WAVHeader,
} from "./wav-chunk-manager";

export {
  AudioLanguageCache,
  getAudioLanguageCache,
  disposeAudioLanguageCache,
  type CachedAudioChapter,
  type AudioCacheMetadata,
} from "./audio-language-cache";

export {
  AudioStreamingService,
  getAudioStreamingService,
  disposeAudioStreamingService,
  AUDIO_QUALITY_LEVELS,
  type AudioStreamingConfig,
  type AudioQualityLevel,
  type PreloadedChapter,
  type RangeRequestResult,
  type StreamingStats,
} from "./audio-streaming";

export {
  AudioOptimizer,
  getAudioOptimizer,
  createAudioOptimizer,
  AUDIO_QUALITY_PRESETS,
  type AudioOptimizationConfig,
  type AudioOptimizationResult,
  type AudioQualityPreset,
} from "./audio-optimizer";
