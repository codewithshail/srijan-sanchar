/**
 * Progressive Loading Manager for TTS Performance Optimization
 * 
 * Implements progressive loading to start playback while processing remaining chunks,
 * providing better user experience with faster initial response times.
 */

export interface LoadingChunk {
  index: number;
  text: string;
  audioData?: ArrayBuffer;
  isLoading: boolean;
  isLoaded: boolean;
  error?: Error;
  loadStartTime?: number;
  loadEndTime?: number;
}

export interface ProgressiveLoadingOptions {
  initialChunkCount?: number; // Number of chunks to load before starting playback
  maxConcurrentLoads?: number; // Maximum concurrent chunk loading
  preloadAhead?: number; // Number of chunks to preload ahead of current playback
  retryAttempts?: number;
  retryDelayMs?: number;
}

export interface LoadingProgress {
  totalChunks: number;
  loadedChunks: number;
  currentlyLoading: number;
  readyForPlayback: boolean;
  playbackStartIndex: number;
  nextLoadIndex: number;
  averageLoadTime: number;
  estimatedTimeRemaining: number;
}

export class ProgressiveLoader {
  private chunks: LoadingChunk[] = [];
  private readonly initialChunkCount: number;
  private readonly maxConcurrentLoads: number;
  private readonly preloadAhead: number;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;
  
  private currentPlaybackIndex = 0;
  private loadingPromises = new Map<number, Promise<void>>();
  private isPlaybackStarted = false;
  
  private onProgressCallback?: (progress: LoadingProgress) => void;
  private onReadyForPlaybackCallback?: (readyChunks: ArrayBuffer[]) => void;
  private onChunkLoadedCallback?: (index: number, audioData: ArrayBuffer) => void;
  private onErrorCallback?: (error: Error, chunkIndex: number) => void;

  constructor(options: ProgressiveLoadingOptions = {}) {
    this.initialChunkCount = options.initialChunkCount || 2;
    this.maxConcurrentLoads = options.maxConcurrentLoads || 3;
    this.preloadAhead = options.preloadAhead || 3;
    this.retryAttempts = options.retryAttempts || 2;
    this.retryDelayMs = options.retryDelayMs || 1000;
    
    console.log('[PROGRESSIVE_LOADER] Initialized with options:', {
      initialChunkCount: this.initialChunkCount,
      maxConcurrentLoads: this.maxConcurrentLoads,
      preloadAhead: this.preloadAhead,
      retryAttempts: this.retryAttempts
    });
  }

  /**
   * Initialize progressive loading with text chunks
   */
  async startLoading(
    textChunks: string[],
    loadChunkFn: (text: string, index: number) => Promise<ArrayBuffer>,
    callbacks: {
      onProgress?: (progress: LoadingProgress) => void;
      onReadyForPlayback?: (readyChunks: ArrayBuffer[]) => void;
      onChunkLoaded?: (index: number, audioData: ArrayBuffer) => void;
      onError?: (error: Error, chunkIndex: number) => void;
    } = {}
  ): Promise<void> {
    
    this.onProgressCallback = callbacks.onProgress;
    this.onReadyForPlaybackCallback = callbacks.onReadyForPlayback;
    this.onChunkLoadedCallback = callbacks.onChunkLoaded;
    this.onErrorCallback = callbacks.onError;
    
    // Initialize chunks
    this.chunks = textChunks.map((text, index) => ({
      index,
      text,
      isLoading: false,
      isLoaded: false
    }));
    
    this.currentPlaybackIndex = 0;
    this.isPlaybackStarted = false;
    this.loadingPromises.clear();
    
    console.log(`[PROGRESSIVE_LOADER] Starting progressive loading for ${textChunks.length} chunks`);
    
    // Start loading initial chunks
    await this.loadInitialChunks(loadChunkFn);
    
    // Continue loading remaining chunks in background
    this.continueBackgroundLoading(loadChunkFn);
  }

  /**
   * Load initial chunks required for playback start
   */
  private async loadInitialChunks(
    loadChunkFn: (text: string, index: number) => Promise<ArrayBuffer>
  ): Promise<void> {
    const initialCount = Math.min(this.initialChunkCount, this.chunks.length);
    
    console.log(`[PROGRESSIVE_LOADER] Loading initial ${initialCount} chunks`);
    
    // Load initial chunks in parallel
    const initialPromises: Promise<void>[] = [];
    
    for (let i = 0; i < initialCount; i++) {
      initialPromises.push(this.loadChunk(i, loadChunkFn));
    }
    
    // Wait for initial chunks to complete
    await Promise.allSettled(initialPromises);
    
    // Check if we have enough chunks loaded to start playback
    const loadedInitialChunks = this.chunks.slice(0, initialCount)
      .filter(chunk => chunk.isLoaded && !chunk.error);
    
    if (loadedInitialChunks.length > 0) {
      console.log(`[PROGRESSIVE_LOADER] Ready for playback with ${loadedInitialChunks.length} initial chunks`);
      
      const readyAudioChunks = loadedInitialChunks
        .map(chunk => chunk.audioData!)
        .filter(Boolean);
      
      if (this.onReadyForPlaybackCallback && readyAudioChunks.length > 0) {
        this.onReadyForPlaybackCallback(readyAudioChunks);
      }
      
      this.isPlaybackStarted = true;
    } else {
      console.error('[PROGRESSIVE_LOADER] No initial chunks loaded successfully');
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error('Failed to load initial chunks'), 0);
      }
    }
    
    this.updateProgress();
  }

  /**
   * Continue loading remaining chunks in background
   */
  private continueBackgroundLoading(
    loadChunkFn: (text: string, index: number) => Promise<ArrayBuffer>
  ): void {
    // Start background loading process
    this.scheduleNextLoads(loadChunkFn);
  }

  /**
   * Schedule next chunk loads based on current playback position
   */
  private scheduleNextLoads(
    loadChunkFn: (text: string, index: number) => Promise<ArrayBuffer>
  ): void {
    const currentLoading = this.loadingPromises.size;
    const availableSlots = this.maxConcurrentLoads - currentLoading;
    
    if (availableSlots <= 0) {
      // No available slots, check again later
      setTimeout(() => this.scheduleNextLoads(loadChunkFn), 100);
      return;
    }
    
    // Find next chunks to load (prioritize chunks near current playback position)
    const chunksToLoad = this.getNextChunksToLoad(availableSlots);
    
    // Start loading selected chunks
    for (const chunkIndex of chunksToLoad) {
      this.loadChunk(chunkIndex, loadChunkFn).then(() => {
        // Schedule next loads when this one completes
        setTimeout(() => this.scheduleNextLoads(loadChunkFn), 10);
      });
    }
    
    // If no chunks to load, we're done
    if (chunksToLoad.length === 0 && currentLoading === 0) {
      console.log('[PROGRESSIVE_LOADER] All chunks loaded');
      this.updateProgress();
    }
  }

  /**
   * Get next chunks to load based on priority
   */
  private getNextChunksToLoad(maxCount: number): number[] {
    const chunksToLoad: number[] = [];
    
    // Priority 1: Chunks needed for immediate playback (current + preload ahead)
    const preloadEnd = Math.min(
      this.currentPlaybackIndex + this.preloadAhead,
      this.chunks.length
    );
    
    for (let i = this.currentPlaybackIndex; i < preloadEnd && chunksToLoad.length < maxCount; i++) {
      const chunk = this.chunks[i];
      if (!chunk.isLoaded && !chunk.isLoading && !chunk.error) {
        chunksToLoad.push(i);
      }
    }
    
    // Priority 2: Fill remaining slots with next unloaded chunks
    for (let i = 0; i < this.chunks.length && chunksToLoad.length < maxCount; i++) {
      const chunk = this.chunks[i];
      if (!chunk.isLoaded && !chunk.isLoading && !chunk.error && !chunksToLoad.includes(i)) {
        chunksToLoad.push(i);
      }
    }
    
    return chunksToLoad;
  }

  /**
   * Load a specific chunk
   */
  private async loadChunk(
    index: number,
    loadChunkFn: (text: string, index: number) => Promise<ArrayBuffer>
  ): Promise<void> {
    const chunk = this.chunks[index];
    if (!chunk || chunk.isLoaded || chunk.isLoading) {
      return;
    }
    
    chunk.isLoading = true;
    chunk.loadStartTime = Date.now();
    
    const loadPromise = this.loadChunkWithRetry(index, loadChunkFn);
    this.loadingPromises.set(index, loadPromise);
    
    try {
      await loadPromise;
    } finally {
      this.loadingPromises.delete(index);
      chunk.isLoading = false;
    }
  }

  /**
   * Load chunk with retry logic
   */
  private async loadChunkWithRetry(
    index: number,
    loadChunkFn: (text: string, index: number) => Promise<ArrayBuffer>
  ): Promise<void> {
    const chunk = this.chunks[index];
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`[PROGRESSIVE_LOADER] Loading chunk ${index} (attempt ${attempt + 1})`);
        
        const audioData = await loadChunkFn(chunk.text, index);
        
        chunk.audioData = audioData;
        chunk.isLoaded = true;
        chunk.loadEndTime = Date.now();
        chunk.error = undefined;
        
        const loadTime = chunk.loadEndTime - (chunk.loadStartTime || 0);
        console.log(`[PROGRESSIVE_LOADER] Chunk ${index} loaded successfully in ${loadTime}ms`);
        
        if (this.onChunkLoadedCallback) {
          this.onChunkLoadedCallback(index, audioData);
        }
        
        this.updateProgress();
        return;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[PROGRESSIVE_LOADER] Chunk ${index} load attempt ${attempt + 1} failed:`, lastError);
        
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelayMs * Math.pow(2, attempt);
          console.log(`[PROGRESSIVE_LOADER] Retrying chunk ${index} in ${delay}ms`);
          await this.delay(delay);
        }
      }
    }
    
    // All attempts failed
    chunk.error = lastError || new Error('Unknown error');
    chunk.loadEndTime = Date.now();
    
    console.error(`[PROGRESSIVE_LOADER] Chunk ${index} failed after ${this.retryAttempts + 1} attempts`);
    
    if (this.onErrorCallback) {
      this.onErrorCallback(chunk.error, index);
    }
    
    this.updateProgress();
  }

  /**
   * Update current playback position (for preloading optimization)
   */
  updatePlaybackPosition(index: number): void {
    this.currentPlaybackIndex = index;
    console.log(`[PROGRESSIVE_LOADER] Playback position updated to chunk ${index}`);
    
    // Trigger loading of upcoming chunks if needed
    this.scheduleNextLoads = this.scheduleNextLoads.bind(this);
  }

  /**
   * Get loading progress information
   */
  getProgress(): LoadingProgress {
    const totalChunks = this.chunks.length;
    const loadedChunks = this.chunks.filter(chunk => chunk.isLoaded).length;
    const currentlyLoading = this.chunks.filter(chunk => chunk.isLoading).length;
    
    const loadedChunksWithTime = this.chunks.filter(
      chunk => chunk.isLoaded && chunk.loadStartTime && chunk.loadEndTime
    );
    
    const averageLoadTime = loadedChunksWithTime.length > 0
      ? loadedChunksWithTime.reduce((sum, chunk) => 
          sum + (chunk.loadEndTime! - chunk.loadStartTime!), 0) / loadedChunksWithTime.length
      : 0;
    
    const remainingChunks = totalChunks - loadedChunks;
    const estimatedTimeRemaining = remainingChunks * averageLoadTime;
    
    return {
      totalChunks,
      loadedChunks,
      currentlyLoading,
      readyForPlayback: this.isPlaybackStarted,
      playbackStartIndex: this.currentPlaybackIndex,
      nextLoadIndex: this.getNextChunksToLoad(1)[0] || -1,
      averageLoadTime,
      estimatedTimeRemaining
    };
  }

  /**
   * Update progress and notify callback
   */
  private updateProgress(): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.getProgress());
    }
  }

  /**
   * Get all loaded audio chunks in order
   */
  getLoadedChunks(): ArrayBuffer[] {
    return this.chunks
      .filter(chunk => chunk.isLoaded && chunk.audioData)
      .sort((a, b) => a.index - b.index)
      .map(chunk => chunk.audioData!);
  }

  /**
   * Get loaded chunks up to a specific index
   */
  getLoadedChunksUpTo(maxIndex: number): ArrayBuffer[] {
    return this.chunks
      .filter(chunk => chunk.index <= maxIndex && chunk.isLoaded && chunk.audioData)
      .sort((a, b) => a.index - b.index)
      .map(chunk => chunk.audioData!);
  }

  /**
   * Check if chunk is loaded
   */
  isChunkLoaded(index: number): boolean {
    const chunk = this.chunks[index];
    return chunk ? chunk.isLoaded : false;
  }

  /**
   * Get chunk loading status
   */
  getChunkStatus(index: number): 'not-started' | 'loading' | 'loaded' | 'error' {
    const chunk = this.chunks[index];
    if (!chunk) return 'not-started';
    
    if (chunk.error) return 'error';
    if (chunk.isLoaded) return 'loaded';
    if (chunk.isLoading) return 'loading';
    return 'not-started';
  }

  /**
   * Cancel all loading operations
   */
  cancel(): void {
    console.log(`[PROGRESSIVE_LOADER] Cancelling ${this.loadingPromises.size} loading operations`);
    
    // Mark all chunks as not loading
    for (const chunk of this.chunks) {
      chunk.isLoading = false;
    }
    
    this.loadingPromises.clear();
    this.isPlaybackStarted = false;
  }

  /**
   * Reset loader state
   */
  reset(): void {
    this.cancel();
    this.chunks = [];
    this.currentPlaybackIndex = 0;
    console.log('[PROGRESSIVE_LOADER] Loader reset');
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Utility function for simple progressive loading
 */
export async function loadProgressively<T>(
  items: T[],
  loadFn: (item: T, index: number) => Promise<ArrayBuffer>,
  options: ProgressiveLoadingOptions & {
    onProgress?: (loaded: number, total: number) => void;
    onReadyForPlayback?: (readyChunks: ArrayBuffer[]) => void;
  } = {}
): Promise<ArrayBuffer[]> {
  
  const loader = new ProgressiveLoader(options);
  
  return new Promise((resolve, reject) => {
    const textChunks = items.map(item => String(item));
    let allChunks: ArrayBuffer[] = [];
    
    loader.startLoading(
      textChunks,
      async (text, index) => loadFn(items[index], index),
      {
        onProgress: (progress) => {
          if (options.onProgress) {
            options.onProgress(progress.loadedChunks, progress.totalChunks);
          }
          
          // Check if all chunks are loaded
          if (progress.loadedChunks === progress.totalChunks) {
            allChunks = loader.getLoadedChunks();
            resolve(allChunks);
          }
        },
        onReadyForPlayback: options.onReadyForPlayback,
        onError: (error) => {
          console.error('[PROGRESSIVE_LOADER] Loading failed:', error);
          reject(error);
        }
      }
    ).catch(reject);
  });
}