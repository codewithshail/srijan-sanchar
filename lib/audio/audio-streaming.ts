/**
 * Audio Streaming Optimization Module
 * 
 * Provides optimized audio streaming capabilities including:
 * - Range request support for efficient seeking
 * - Chapter preloading for seamless playback
 * - Audio file size optimization
 * - Adaptive bitrate streaming (optional)
 * 
 * Requirements: 8.2, 8.3
 */

/**
 * Configuration for audio streaming
 */
export interface AudioStreamingConfig {
  /** Number of chapters to preload ahead */
  preloadAhead?: number;
  /** Enable adaptive bitrate streaming */
  enableAdaptiveBitrate?: boolean;
  /** Target bitrate for adaptive streaming (kbps) */
  targetBitrate?: number;
  /** Buffer size in seconds */
  bufferSize?: number;
  /** Enable range request support */
  enableRangeRequests?: boolean;
  /** Chunk size for range requests (bytes) */
  rangeChunkSize?: number;
}

/**
 * Audio quality levels for adaptive bitrate
 */
export interface AudioQualityLevel {
  bitrate: number;
  label: string;
  suffix: string;
}

/**
 * Preloaded chapter data
 */
export interface PreloadedChapter {
  index: number;
  url: string;
  data: ArrayBuffer | null;
  status: 'pending' | 'loading' | 'loaded' | 'error';
  error?: string;
  loadedAt?: number;
  size?: number;
}

/**
 * Range request result
 */
export interface RangeRequestResult {
  data: ArrayBuffer;
  start: number;
  end: number;
  total: number;
  isComplete: boolean;
}

/**
 * Streaming statistics
 */
export interface StreamingStats {
  totalBytesLoaded: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageLoadTime: number;
  preloadedChapters: number;
  currentBitrate: number;
}

const DEFAULT_CONFIG: Required<AudioStreamingConfig> = {
  preloadAhead: 2,
  enableAdaptiveBitrate: false,
  targetBitrate: 128,
  bufferSize: 30,
  enableRangeRequests: true,
  rangeChunkSize: 64 * 1024, // 64KB chunks
};

/**
 * Audio quality levels for adaptive streaming
 */
export const AUDIO_QUALITY_LEVELS: AudioQualityLevel[] = [
  { bitrate: 64, label: 'Low', suffix: '_64k' },
  { bitrate: 128, label: 'Medium', suffix: '_128k' },
  { bitrate: 192, label: 'High', suffix: '_192k' },
  { bitrate: 320, label: 'Ultra', suffix: '_320k' },
];

/**
 * Audio Streaming Service
 * 
 * Manages optimized audio streaming with preloading and range requests
 */
export class AudioStreamingService {
  private config: Required<AudioStreamingConfig>;
  private preloadedChapters: Map<number, PreloadedChapter> = new Map();
  private preloadQueue: number[] = [];
  private isPreloading: boolean = false;
  private abortControllers: Map<number, AbortController> = new Map();
  private stats: StreamingStats = {
    totalBytesLoaded: 0,
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLoadTime: 0,
    preloadedChapters: 0,
    currentBitrate: 128,
  };
  private loadTimes: number[] = [];
  private currentQualityLevel: number = 1; // Default to medium quality

  constructor(config: AudioStreamingConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[AUDIO_STREAMING] Initialized with config:', this.config);
  }

  /**
   * Fetch audio with range request support
   */
  async fetchWithRange(
    url: string,
    start?: number,
    end?: number
  ): Promise<RangeRequestResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    const headers: HeadersInit = {};
    
    if (this.config.enableRangeRequests && (start !== undefined || end !== undefined)) {
      const rangeStart = start ?? 0;
      const rangeEnd = end ?? '';
      headers['Range'] = `bytes=${rangeStart}-${rangeEnd}`;
    }

    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      const loadTime = Date.now() - startTime;
      this.updateLoadTimeStats(loadTime);
      this.stats.totalBytesLoaded += data.byteLength;

      // Parse content-range header if present
      const contentRange = response.headers.get('Content-Range');
      let rangeStart = 0;
      let rangeEnd = data.byteLength - 1;
      let total = data.byteLength;

      if (contentRange) {
        const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+|\*)/);
        if (match) {
          rangeStart = parseInt(match[1], 10);
          rangeEnd = parseInt(match[2], 10);
          total = match[3] === '*' ? -1 : parseInt(match[3], 10);
        }
      }

      console.log(`[AUDIO_STREAMING] Fetched ${data.byteLength} bytes in ${loadTime}ms`);

      return {
        data,
        start: rangeStart,
        end: rangeEnd,
        total,
        isComplete: total === -1 || rangeEnd >= total - 1,
      };
    } catch (error) {
      console.error('[AUDIO_STREAMING] Fetch error:', error);
      throw error;
    }
  }

  /**
   * Preload chapters ahead of current playback position
   */
  async preloadChapters(
    chapterUrls: string[],
    currentIndex: number
  ): Promise<void> {
    // Clear old preload queue
    this.preloadQueue = [];

    // Determine which chapters to preload
    const chaptersToPreload: number[] = [];
    for (let i = 1; i <= this.config.preloadAhead; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < chapterUrls.length && !this.preloadedChapters.has(nextIndex)) {
        chaptersToPreload.push(nextIndex);
      }
    }

    if (chaptersToPreload.length === 0) {
      return;
    }

    this.preloadQueue = chaptersToPreload;
    console.log(`[AUDIO_STREAMING] Queuing preload for chapters: ${chaptersToPreload.join(', ')}`);

    // Start preloading if not already in progress
    if (!this.isPreloading) {
      await this.processPreloadQueue(chapterUrls);
    }
  }

  /**
   * Process the preload queue
   */
  private async processPreloadQueue(chapterUrls: string[]): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;

    while (this.preloadQueue.length > 0) {
      const chapterIndex = this.preloadQueue.shift()!;
      const url = chapterUrls[chapterIndex];

      if (!url || this.preloadedChapters.get(chapterIndex)?.status === 'loaded') {
        continue;
      }

      // Create abort controller for this preload
      const abortController = new AbortController();
      this.abortControllers.set(chapterIndex, abortController);

      // Mark as loading
      this.preloadedChapters.set(chapterIndex, {
        index: chapterIndex,
        url,
        data: null,
        status: 'loading',
      });

      try {
        const response = await fetch(url, {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.arrayBuffer();

        this.preloadedChapters.set(chapterIndex, {
          index: chapterIndex,
          url,
          data,
          status: 'loaded',
          loadedAt: Date.now(),
          size: data.byteLength,
        });

        this.stats.preloadedChapters++;
        this.stats.totalBytesLoaded += data.byteLength;

        console.log(`[AUDIO_STREAMING] Preloaded chapter ${chapterIndex} (${data.byteLength} bytes)`);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          console.log(`[AUDIO_STREAMING] Preload cancelled for chapter ${chapterIndex}`);
        } else {
          console.error(`[AUDIO_STREAMING] Preload failed for chapter ${chapterIndex}:`, error);
          this.preloadedChapters.set(chapterIndex, {
            index: chapterIndex,
            url,
            data: null,
            status: 'error',
            error: (error as Error).message,
          });
        }
      } finally {
        this.abortControllers.delete(chapterIndex);
      }
    }

    this.isPreloading = false;
  }

  /**
   * Get preloaded chapter data if available
   */
  getPreloadedChapter(index: number): ArrayBuffer | null {
    const chapter = this.preloadedChapters.get(index);
    
    if (chapter?.status === 'loaded' && chapter.data) {
      this.stats.cacheHits++;
      console.log(`[AUDIO_STREAMING] Cache hit for chapter ${index}`);
      return chapter.data;
    }

    this.stats.cacheMisses++;
    return null;
  }

  /**
   * Check if a chapter is preloaded
   */
  isChapterPreloaded(index: number): boolean {
    const chapter = this.preloadedChapters.get(index);
    return chapter?.status === 'loaded' && chapter.data !== null;
  }

  /**
   * Cancel all pending preloads
   */
  cancelPreloads(): void {
    this.preloadQueue = [];
    
    for (const [index, controller] of this.abortControllers) {
      controller.abort();
      console.log(`[AUDIO_STREAMING] Cancelled preload for chapter ${index}`);
    }
    
    this.abortControllers.clear();
    this.isPreloading = false;
  }

  /**
   * Clear preloaded chapters (optionally keep recent ones)
   */
  clearPreloadedChapters(keepRecent: number = 0): void {
    if (keepRecent <= 0) {
      this.preloadedChapters.clear();
      this.stats.preloadedChapters = 0;
      return;
    }

    // Sort by loadedAt and keep most recent
    const sorted = Array.from(this.preloadedChapters.entries())
      .filter(([, ch]) => ch.status === 'loaded')
      .sort((a, b) => (b[1].loadedAt || 0) - (a[1].loadedAt || 0));

    const toRemove = sorted.slice(keepRecent);
    for (const [index] of toRemove) {
      this.preloadedChapters.delete(index);
    }

    this.stats.preloadedChapters = Math.min(keepRecent, sorted.length);
  }

  /**
   * Get optimal quality level based on network conditions
   */
  getOptimalQualityLevel(): AudioQualityLevel {
    if (!this.config.enableAdaptiveBitrate) {
      return AUDIO_QUALITY_LEVELS[this.currentQualityLevel];
    }

    // Calculate average load time
    const avgLoadTime = this.stats.averageLoadTime;
    
    // Adjust quality based on load times
    if (avgLoadTime > 3000 && this.currentQualityLevel > 0) {
      // Slow connection - decrease quality
      this.currentQualityLevel--;
      console.log(`[AUDIO_STREAMING] Decreasing quality to ${AUDIO_QUALITY_LEVELS[this.currentQualityLevel].label}`);
    } else if (avgLoadTime < 500 && this.currentQualityLevel < AUDIO_QUALITY_LEVELS.length - 1) {
      // Fast connection - increase quality
      this.currentQualityLevel++;
      console.log(`[AUDIO_STREAMING] Increasing quality to ${AUDIO_QUALITY_LEVELS[this.currentQualityLevel].label}`);
    }

    this.stats.currentBitrate = AUDIO_QUALITY_LEVELS[this.currentQualityLevel].bitrate;
    return AUDIO_QUALITY_LEVELS[this.currentQualityLevel];
  }

  /**
   * Set quality level manually
   */
  setQualityLevel(level: number): void {
    if (level >= 0 && level < AUDIO_QUALITY_LEVELS.length) {
      this.currentQualityLevel = level;
      this.stats.currentBitrate = AUDIO_QUALITY_LEVELS[level].bitrate;
      console.log(`[AUDIO_STREAMING] Quality set to ${AUDIO_QUALITY_LEVELS[level].label}`);
    }
  }

  /**
   * Update load time statistics
   */
  private updateLoadTimeStats(loadTime: number): void {
    this.loadTimes.push(loadTime);
    
    // Keep only last 10 load times
    if (this.loadTimes.length > 10) {
      this.loadTimes.shift();
    }

    // Calculate average
    this.stats.averageLoadTime = 
      this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length;
  }

  /**
   * Get streaming statistics
   */
  getStats(): StreamingStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalBytesLoaded: 0,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLoadTime: 0,
      preloadedChapters: this.preloadedChapters.size,
      currentBitrate: AUDIO_QUALITY_LEVELS[this.currentQualityLevel].bitrate,
    };
    this.loadTimes = [];
  }

  /**
   * Dispose of the service and cleanup resources
   */
  dispose(): void {
    this.cancelPreloads();
    this.preloadedChapters.clear();
    this.loadTimes = [];
    console.log('[AUDIO_STREAMING] Service disposed');
  }
}

// Singleton instance
let streamingServiceInstance: AudioStreamingService | null = null;

/**
 * Get or create the audio streaming service instance
 */
export function getAudioStreamingService(
  config?: AudioStreamingConfig
): AudioStreamingService {
  if (!streamingServiceInstance) {
    streamingServiceInstance = new AudioStreamingService(config);
  }
  return streamingServiceInstance;
}

/**
 * Dispose the audio streaming service instance
 */
export function disposeAudioStreamingService(): void {
  if (streamingServiceInstance) {
    streamingServiceInstance.dispose();
    streamingServiceInstance = null;
  }
}
