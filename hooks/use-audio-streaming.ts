"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  AudioStreamingService,
  AudioStreamingConfig,
  StreamingStats,
  AudioQualityLevel,
  AUDIO_QUALITY_LEVELS,
} from "@/lib/audio/audio-streaming";

/**
 * Audio streaming state
 */
interface AudioStreamingState {
  isLoading: boolean;
  isPreloading: boolean;
  currentChapterIndex: number;
  preloadedChapters: number[];
  error: string | null;
  stats: StreamingStats;
  qualityLevel: AudioQualityLevel;
}

/**
 * Options for the audio streaming hook
 */
interface UseAudioStreamingOptions extends AudioStreamingConfig {
  /** Chapter URLs to manage */
  chapterUrls: string[];
  /** Auto-preload on chapter change */
  autoPreload?: boolean;
  /** Callback when chapter is ready */
  onChapterReady?: (index: number, data: ArrayBuffer) => void;
  /** Callback on preload progress */
  onPreloadProgress?: (loaded: number, total: number) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Hook for managing audio streaming with preloading and range requests
 * 
 * Provides:
 * - Automatic chapter preloading
 * - Range request support for efficient seeking
 * - Adaptive bitrate selection
 * - Streaming statistics
 * 
 * Requirements: 8.2, 8.3
 */
export function useAudioStreaming(options: UseAudioStreamingOptions) {
  const {
    chapterUrls,
    autoPreload = true,
    onChapterReady,
    onPreloadProgress,
    onError,
    ...streamingConfig
  } = options;

  const [state, setState] = useState<AudioStreamingState>({
    isLoading: false,
    isPreloading: false,
    currentChapterIndex: 0,
    preloadedChapters: [],
    error: null,
    stats: {
      totalBytesLoaded: 0,
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLoadTime: 0,
      preloadedChapters: 0,
      currentBitrate: 128,
    },
    qualityLevel: AUDIO_QUALITY_LEVELS[1], // Default to medium
  });

  const streamingServiceRef = useRef<AudioStreamingService | null>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize streaming service
  useEffect(() => {
    streamingServiceRef.current = new AudioStreamingService(streamingConfig);

    return () => {
      if (streamingServiceRef.current) {
        streamingServiceRef.current.dispose();
        streamingServiceRef.current = null;
      }
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  // Update stats periodically
  useEffect(() => {
    const updateStats = () => {
      if (streamingServiceRef.current) {
        const stats = streamingServiceRef.current.getStats();
        const qualityLevel = streamingServiceRef.current.getOptimalQualityLevel();
        
        setState((prev) => ({
          ...prev,
          stats,
          qualityLevel,
        }));
      }
    };

    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Load a specific chapter
   */
  const loadChapter = useCallback(
    async (index: number): Promise<ArrayBuffer | null> => {
      if (!streamingServiceRef.current || index < 0 || index >= chapterUrls.length) {
        return null;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Check if chapter is already preloaded
        const preloaded = streamingServiceRef.current.getPreloadedChapter(index);
        if (preloaded) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            currentChapterIndex: index,
          }));
          onChapterReady?.(index, preloaded);
          return preloaded;
        }

        // Fetch with range support
        const result = await streamingServiceRef.current.fetchWithRange(
          chapterUrls[index]
        );

        setState((prev) => ({
          ...prev,
          isLoading: false,
          currentChapterIndex: index,
        }));

        onChapterReady?.(index, result.data);

        // Trigger preloading of next chapters
        if (autoPreload) {
          triggerPreload(index);
        }

        return result.data;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to load chapter";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        onError?.(error instanceof Error ? error : new Error(errorMessage));
        return null;
      }
    },
    [chapterUrls, autoPreload, onChapterReady, onError]
  );

  /**
   * Trigger preloading of upcoming chapters
   */
  const triggerPreload = useCallback(
    (currentIndex: number) => {
      if (!streamingServiceRef.current || chapterUrls.length === 0) {
        return;
      }

      // Debounce preload trigger
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }

      preloadTimeoutRef.current = setTimeout(async () => {
        setState((prev) => ({ ...prev, isPreloading: true }));

        try {
          await streamingServiceRef.current!.preloadChapters(
            chapterUrls,
            currentIndex
          );

          // Update preloaded chapters list
          const preloadedIndices: number[] = [];
          for (let i = 0; i < chapterUrls.length; i++) {
            if (streamingServiceRef.current!.isChapterPreloaded(i)) {
              preloadedIndices.push(i);
            }
          }

          setState((prev) => ({
            ...prev,
            isPreloading: false,
            preloadedChapters: preloadedIndices,
          }));

          onPreloadProgress?.(preloadedIndices.length, chapterUrls.length);
        } catch (error) {
          console.error("[USE_AUDIO_STREAMING] Preload error:", error);
          setState((prev) => ({ ...prev, isPreloading: false }));
        }
      }, 500); // 500ms debounce
    },
    [chapterUrls, onPreloadProgress]
  );

  /**
   * Preload specific chapters
   */
  const preloadChapters = useCallback(
    async (indices: number[]) => {
      if (!streamingServiceRef.current) return;

      setState((prev) => ({ ...prev, isPreloading: true }));

      for (const index of indices) {
        if (index >= 0 && index < chapterUrls.length) {
          try {
            await streamingServiceRef.current.fetchWithRange(chapterUrls[index]);
          } catch (error) {
            console.error(`[USE_AUDIO_STREAMING] Failed to preload chapter ${index}:`, error);
          }
        }
      }

      setState((prev) => ({ ...prev, isPreloading: false }));
    },
    [chapterUrls]
  );

  /**
   * Cancel all pending preloads
   */
  const cancelPreloads = useCallback(() => {
    if (streamingServiceRef.current) {
      streamingServiceRef.current.cancelPreloads();
    }
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    setState((prev) => ({ ...prev, isPreloading: false }));
  }, []);

  /**
   * Clear preloaded chapters
   */
  const clearPreloaded = useCallback((keepRecent: number = 0) => {
    if (streamingServiceRef.current) {
      streamingServiceRef.current.clearPreloadedChapters(keepRecent);
      setState((prev) => ({ ...prev, preloadedChapters: [] }));
    }
  }, []);

  /**
   * Set quality level manually
   */
  const setQualityLevel = useCallback((level: number) => {
    if (streamingServiceRef.current) {
      streamingServiceRef.current.setQualityLevel(level);
      setState((prev) => ({
        ...prev,
        qualityLevel: AUDIO_QUALITY_LEVELS[level] || AUDIO_QUALITY_LEVELS[1],
      }));
    }
  }, []);

  /**
   * Check if a chapter is preloaded
   */
  const isChapterPreloaded = useCallback((index: number): boolean => {
    return streamingServiceRef.current?.isChapterPreloaded(index) ?? false;
  }, []);

  /**
   * Get preloaded chapter data
   */
  const getPreloadedChapter = useCallback((index: number): ArrayBuffer | null => {
    return streamingServiceRef.current?.getPreloadedChapter(index) ?? null;
  }, []);

  /**
   * Reset streaming state
   */
  const reset = useCallback(() => {
    cancelPreloads();
    clearPreloaded();
    if (streamingServiceRef.current) {
      streamingServiceRef.current.resetStats();
    }
    setState({
      isLoading: false,
      isPreloading: false,
      currentChapterIndex: 0,
      preloadedChapters: [],
      error: null,
      stats: {
        totalBytesLoaded: 0,
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageLoadTime: 0,
        preloadedChapters: 0,
        currentBitrate: 128,
      },
      qualityLevel: AUDIO_QUALITY_LEVELS[1],
    });
  }, [cancelPreloads, clearPreloaded]);

  return {
    // State
    ...state,
    totalChapters: chapterUrls.length,
    
    // Actions
    loadChapter,
    preloadChapters,
    cancelPreloads,
    clearPreloaded,
    setQualityLevel,
    reset,
    
    // Utilities
    isChapterPreloaded,
    getPreloadedChapter,
    
    // Quality levels
    availableQualityLevels: AUDIO_QUALITY_LEVELS,
  };
}

export default useAudioStreaming;
