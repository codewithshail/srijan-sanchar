"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import { createRobustStreamParser } from "@/lib/streaming/robust-stream-parser";
import { createWAVAudioChunkManager } from "@/lib/audio/wav-chunk-manager";
import { WebAudioSequentialPlayer } from "@/components/sequential-audio-player";
import { 
  getAudioCache, 
  getMemoryManager, 
  ParallelProcessor, 
  ProgressiveLoader 
} from "@/lib/performance";

interface StreamingTTSOptions {
  text: string;
  language: string;
  speaker?: string;
  pitch?: number;
  pace?: number;
  retryAttempts?: number;
  chunkSize?: number;
}

interface StreamingTTSState {
  isLoading: boolean;
  isStreaming: boolean;
  isPlaying: boolean;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  error: string | null;
  audioChunks: ArrayBuffer[];
  combinedAudio: ArrayBuffer | null;
  duration: number;
  currentTime: number;
  retryCount: number;
}

interface ErrorRecoveryStrategy {
  type: "retry" | "skip" | "abort";
  maxAttempts: number;
  backoffMs: number;
}

class StreamingErrorHandler {
  private retryAttempts: Map<string, number> = new Map();

  async handleError(
    error: Error,
    context: string,
    strategy: ErrorRecoveryStrategy
  ): Promise<boolean> {
    const attempts = this.retryAttempts.get(context) || 0;

    console.log(
      `[ERROR_HANDLER] Handling error in ${context}, attempt ${attempts + 1}/${
        strategy.maxAttempts
      }:`,
      error.message
    );

    switch (strategy.type) {
      case "retry":
        if (attempts < strategy.maxAttempts) {
          this.retryAttempts.set(context, attempts + 1);
          await this.delay(strategy.backoffMs * Math.pow(2, attempts));
          return true; // Retry
        }
        break;

      case "skip":
        console.warn(`[ERROR_HANDLER] Skipping failed operation: ${context}`);
        return false; // Don't retry, continue with next

      case "abort":
        throw error;
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  reset(context?: string): void {
    if (context) {
      this.retryAttempts.delete(context);
    } else {
      this.retryAttempts.clear();
    }
  }
}

export function useStreamingTTS() {
  const [state, setState] = useState<StreamingTTSState>({
    isLoading: false,
    isStreaming: false,
    isPlaying: false,
    progress: 0,
    currentChunk: 0,
    totalChunks: 0,
    error: null,
    audioChunks: [],
    combinedAudio: null,
    duration: 0,
    currentTime: 0,
    retryCount: 0,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const audioPlayerRef = useRef<WebAudioSequentialPlayer | null>(null);
  const errorHandlerRef = useRef<StreamingErrorHandler>(
    new StreamingErrorHandler()
  );
  
  // Performance optimization refs
  const audioCacheRef = useRef(getAudioCache({
    maxEntries: 50,
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    ttlMs: 30 * 60 * 1000 // 30 minutes
  }));
  const memoryManagerRef = useRef(getMemoryManager({
    maxBuffers: 30,
    maxMemoryMB: 80,
    bufferTtlMs: 15 * 60 * 1000 // 15 minutes
  }));
  const parallelProcessorRef = useRef<ParallelProcessor<string, ArrayBuffer> | null>(null);
  const progressiveLoaderRef = useRef<ProgressiveLoader | null>(null);

  // Initialize audio player
  useEffect(() => {
    audioPlayerRef.current = new WebAudioSequentialPlayer();

    const player = audioPlayerRef.current;

    // Set up progress tracking
    player.onProgress((progressPercent) => {
      setState((prev) => ({
        ...prev,
        progress: progressPercent,
        currentTime: player.getCurrentTime(),
      }));
    });

    // Set up completion callback
    player.onComplete(() => {
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        progress: 100,
      }));
      
      // Mark audio buffers as inactive for memory optimization
      setTimeout(() => {
        memoryManagerRef.current.disposeInactiveBuffers();
      }, 5000); // Wait 5 seconds before cleanup
      
      console.log("[STREAMING_TTS] Audio playback completed");
    });

    // Set up error callback
    player.onError((error) => {
      console.error("[STREAMING_TTS] Audio player error:", error);
      setState((prev) => ({
        ...prev,
        error: `Audio playback error: ${error.message}`,
        isPlaying: false,
      }));
      toast.error(`Audio Error: ${error.message}`);
    });

    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.dispose();
      }
      
      // Cleanup performance optimization resources
      if (parallelProcessorRef.current) {
        parallelProcessorRef.current.cancel();
      }
      if (progressiveLoaderRef.current) {
        progressiveLoaderRef.current.cancel();
      }
      memoryManagerRef.current.dispose();
    };
  }, []);

  const startStreaming = useCallback(
    async (options: StreamingTTSOptions) => {
      console.log("[STREAMING_TTS] Starting stream with options:", options);

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Reset error handler
      errorHandlerRef.current.reset();

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isStreaming: false,
        isPlaying: false,
        progress: 0,
        currentChunk: 0,
        totalChunks: 0,
        error: null,
        audioChunks: [],
        combinedAudio: null,
        duration: 0,
        currentTime: 0,
        retryCount: 0,
      }));

      const maxRetries = options.retryAttempts || 3;
      const errorStrategy: ErrorRecoveryStrategy = {
        type: "retry",
        maxAttempts: maxRetries,
        backoffMs: 1000,
      };

      const attemptStreaming = async (): Promise<void> => {
        try {
          // Check cache first for the complete text
          const cacheKey = `${options.text}-${options.language}-${options.speaker || 'default'}-${options.pitch || 0}-${options.pace || 1}`;
          const cachedAudio = audioCacheRef.current.getCachedAudio(
            options.text,
            options.language,
            options.speaker || 'default',
            options.pitch || 0,
            options.pace || 1
          );

          if (cachedAudio) {
            console.log("[STREAMING_TTS] Using cached audio");
            
            // Register with memory manager
            const bufferId = `cached-${Date.now()}`;
            memoryManagerRef.current.registerBuffer(bufferId, cachedAudio, {
              chunkIndex: 0,
              duration: 0
            });

            // Load into audio player
            if (audioPlayerRef.current) {
              await audioPlayerRef.current.loadChunks([cachedAudio]);
              const duration = audioPlayerRef.current.getDuration();

              setState((prev) => ({
                ...prev,
                isLoading: false,
                isStreaming: false,
                audioChunks: [cachedAudio],
                combinedAudio: cachedAudio,
                duration,
                progress: 100,
                totalChunks: 1,
                currentChunk: 1,
              }));
            }
            return;
          }

          // Initialize progressive loader for better UX
          progressiveLoaderRef.current = new ProgressiveLoader({
            initialChunkCount: 2,
            maxConcurrentLoads: 3,
            preloadAhead: 2
          });

          const response = await fetch("/api/tts/stream", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(options),
            signal: abortControllerRef.current?.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          if (!response.body) {
            throw new Error("No response body");
          }

          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: true,
          }));

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          const partialChunks: { [key: number]: string } = {}; // Store partial base64 data
          const audioChunks: ArrayBuffer[] = [];
          let totalChunks = 0;
          let progressivePlaybackStarted = false;

          // Create robust stream parser to handle incomplete JSON chunks
          const streamParser = createRobustStreamParser();
          console.log(
            "[STREAMING_TTS] Using robust stream parser with performance optimizations"
          );

          // Create WAV audio chunk manager for proper audio concatenation
          const audioChunkManager = createWAVAudioChunkManager();
          console.log(
            "[STREAMING_TTS] Using WAV audio chunk manager with memory optimization"
          );

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) break;

              const chunk = decoder.decode(value);
              console.log(
                "[STREAMING_TTS] Received chunk:",
                chunk.length,
                "bytes"
              );

              // Use robust parser to handle incomplete JSON chunks
              const parsedDataArray = streamParser.parseChunk(chunk);

              for (const data of parsedDataArray) {
                console.log(
                  "[STREAMING_TTS] Parsed data:",
                  data.type,
                  data.index
                );

                if (data.type === "audio_chunk") {
                  // Single chunk - process with performance optimizations
                  const audioBuffer = base64ToArrayBuffer(data.data!);

                  // Register with memory manager
                  const bufferId = `chunk-${data.index}-${Date.now()}`;
                  memoryManagerRef.current.registerBuffer(bufferId, audioBuffer, {
                    chunkIndex: data.index,
                    duration: 0
                  });

                  // Set total chunks if not already set
                  if (audioChunkManager.getTotalChunks() === 0) {
                    audioChunkManager.setTotalChunks(data.total!);
                    totalChunks = data.total!;
                    setState((prev) => ({
                      ...prev,
                      totalChunks: data.total!,
                    }));
                  }

                  // Add chunk to manager for proper concatenation
                  audioChunkManager.addChunk(audioBuffer, data.index!);
                  audioChunks[data.index!] = audioBuffer;

                  setState((prev) => ({
                    ...prev,
                    audioChunks: [...audioChunks.filter(Boolean)],
                    currentChunk: data.index! + 1,
                    progress: audioChunkManager.getProgress(),
                  }));

                  // Progressive playback: start playing after first 2 chunks
                  if (!progressivePlaybackStarted && audioChunks.filter(Boolean).length >= 2) {
                    progressivePlaybackStarted = true;
                    console.log("[STREAMING_TTS] Starting progressive playback");
                    
                    if (audioPlayerRef.current) {
                      try {
                        const readyChunks = audioChunks.filter(Boolean);
                        await audioPlayerRef.current.loadChunks(readyChunks);
                        
                        setState((prev) => ({
                          ...prev,
                          duration: audioPlayerRef.current!.getDuration(),
                        }));
                        
                        console.log("[STREAMING_TTS] Progressive playback ready with", readyChunks.length, "chunks");
                      } catch (error) {
                        console.error("[STREAMING_TTS] Progressive playback setup failed:", error);
                      }
                    }
                  }

                } else if (data.type === "audio_chunk_part") {
                  // Multi-part chunk - accumulate parts
                  if (!partialChunks[data.index!]) {
                    partialChunks[data.index!] = "";
                  }

                  partialChunks[data.index!] += data.data!;

                  // If this is the last part, process the complete chunk
                  if (data.isLastPart) {
                    const completeBase64 = partialChunks[data.index!];
                    const audioBuffer = base64ToArrayBuffer(completeBase64);

                    // Register with memory manager
                    const bufferId = `chunk-${data.index}-${Date.now()}`;
                    memoryManagerRef.current.registerBuffer(bufferId, audioBuffer, {
                      chunkIndex: data.index,
                      duration: 0
                    });

                    // Set total chunks if not already set
                    if (audioChunkManager.getTotalChunks() === 0) {
                      audioChunkManager.setTotalChunks(data.total!);
                      totalChunks = data.total!;
                      setState((prev) => ({
                        ...prev,
                        totalChunks: data.total!,
                      }));
                    }

                    // Add chunk to manager for proper concatenation
                    audioChunkManager.addChunk(audioBuffer, data.index!);
                    audioChunks[data.index!] = audioBuffer;

                    setState((prev) => ({
                      ...prev,
                      audioChunks: [...audioChunks.filter(Boolean)],
                      currentChunk: data.index! + 1,
                      progress: audioChunkManager.getProgress(),
                    }));

                    // Progressive playback check
                    if (!progressivePlaybackStarted && audioChunks.filter(Boolean).length >= 2) {
                      progressivePlaybackStarted = true;
                      console.log("[STREAMING_TTS] Starting progressive playback");
                      
                      if (audioPlayerRef.current) {
                        try {
                          const readyChunks = audioChunks.filter(Boolean);
                          await audioPlayerRef.current.loadChunks(readyChunks);
                          
                          setState((prev) => ({
                            ...prev,
                            duration: audioPlayerRef.current!.getDuration(),
                          }));
                          
                          console.log("[STREAMING_TTS] Progressive playback ready with", readyChunks.length, "chunks");
                        } catch (error) {
                          console.error("[STREAMING_TTS] Progressive playback setup failed:", error);
                        }
                      }
                    }

                    // Clean up
                    delete partialChunks[data.index!];
                  }
                } else if (data.type === "complete") {
                  // Combine all audio chunks using proper WAV concatenation
                  const combinedAudio = audioChunkManager.combineChunks();
                  const finalAudioChunks = audioChunkManager.getAllChunks();

                  // Cache the combined audio for future use
                  audioCacheRef.current.setCachedAudio(
                    options.text,
                    options.language,
                    options.speaker || 'default',
                    options.pitch || 0,
                    options.pace || 1,
                    combinedAudio
                  );

                  // Load chunks into audio player for seamless playback
                  if (audioPlayerRef.current && finalAudioChunks.length > 0) {
                    try {
                      if (!progressivePlaybackStarted) {
                        await audioPlayerRef.current.loadChunks(finalAudioChunks);
                      } else {
                        // Update with all chunks for complete playback
                        await audioPlayerRef.current.loadChunks(finalAudioChunks);
                      }
                      
                      const duration = audioPlayerRef.current.getDuration();

                      setState((prev) => ({
                        ...prev,
                        isStreaming: false,
                        combinedAudio,
                        audioChunks: finalAudioChunks,
                        duration,
                        progress: 100,
                      }));

                      console.log(
                        "[STREAMING_TTS] Audio chunks loaded into player, duration:",
                        duration
                      );
                    } catch (error) {
                      console.error(
                        "[STREAMING_TTS] Failed to load audio chunks into player:",
                        error
                      );
                      setState((prev) => ({
                        ...prev,
                        error: `Failed to load audio: ${error}`,
                        isStreaming: false,
                      }));
                    }
                  } else {
                    setState((prev) => ({
                      ...prev,
                      isStreaming: false,
                      combinedAudio,
                      audioChunks: finalAudioChunks,
                      progress: 100,
                    }));
                  }

                  console.log(
                    "[STREAMING_TTS] Stream completed successfully with",
                    audioChunkManager.getChunkCount(),
                    "chunks"
                  );
                  return; // Exit the streaming loop
                } else if (data.type === "error") {
                  throw new Error(data.message || "Streaming error");
                }
              }
            }
          } finally {
            reader.releaseLock();

            // Log any remaining buffered data for debugging
            if (streamParser.hasBufferedData()) {
              console.warn(
                "[STREAMING_TTS] Stream ended with buffered data:",
                streamParser.getStats()
              );
            }

            // Reset parser state
            streamParser.reset();
            
            // Cleanup progressive loader
            if (progressiveLoaderRef.current) {
              progressiveLoaderRef.current.cancel();
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            // Stream was cancelled
            setState((prev) => ({
              ...prev,
              isLoading: false,
              isStreaming: false,
              error: "Stream cancelled",
            }));
            return;
          }

          console.error("Streaming TTS error:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Try to recover from the error
          const shouldRetry = await errorHandlerRef.current.handleError(
            error as Error,
            "streaming",
            errorStrategy
          );

          if (shouldRetry) {
            setState((prev) => ({
              ...prev,
              retryCount: prev.retryCount + 1,
              error: `Retrying... (${prev.retryCount + 1}/${maxRetries})`,
            }));

            console.log(
              `[STREAMING_TTS] Retrying stream attempt ${
                state.retryCount + 1
              }/${maxRetries}`
            );
            await attemptStreaming();
            return;
          }

          // Final failure
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isStreaming: false,
            error: errorMessage,
          }));

          toast.error(`TTS Error: ${errorMessage}`);
        }
      };

      await attemptStreaming();
    },
    [state.retryCount]
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Stop audio playback if active
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
    }

    setState((prev) => ({
      ...prev,
      isStreaming: false,
      isPlaying: false,
    }));
  }, []);

  const playAudio = useCallback(async () => {
    if (!audioPlayerRef.current || state.audioChunks.length === 0) {
      toast.error("No audio available to play");
      return;
    }

    try {
      setState((prev) => ({ ...prev, error: null }));
      await audioPlayerRef.current.play();
      setState((prev) => ({ ...prev, isPlaying: true }));
    } catch (error) {
      console.error("[STREAMING_TTS] Failed to start audio playback:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown playback error";
      setState((prev) => ({ ...prev, error: errorMessage }));
      toast.error(`Playback Error: ${errorMessage}`);
    }
  }, [state.audioChunks.length]);

  const pauseAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setState((prev) => ({ ...prev, isPlaying: false }));
    }
  }, []);

  const stopAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        progress: 0,
        currentTime: 0,
      }));
    }
  }, []);

  const seekTo = useCallback(
    (position: number) => {
      if (audioPlayerRef.current && state.duration > 0) {
        const targetTime = (position / 100) * state.duration;
        audioPlayerRef.current.seekTo(targetTime);
        setState((prev) => ({
          ...prev,
          currentTime: targetTime,
          progress: position,
        }));
      }
    },
    [state.duration]
  );

  const retryStreaming = useCallback(
    async (options: StreamingTTSOptions) => {
      console.log("[STREAMING_TTS] Manual retry requested");
      errorHandlerRef.current.reset();
      await startStreaming(options);
    },
    [startStreaming]
  );

  const reset = useCallback(() => {
    // Stop any active streaming or playback
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
    }

    // Reset error handler
    errorHandlerRef.current.reset();

    setState({
      isLoading: false,
      isStreaming: false,
      isPlaying: false,
      progress: 0,
      currentChunk: 0,
      totalChunks: 0,
      error: null,
      audioChunks: [],
      combinedAudio: null,
      duration: 0,
      currentTime: 0,
      retryCount: 0,
    });
  }, []);

  // Performance statistics getter
  const getPerformanceStats = useCallback(() => {
    return {
      cache: audioCacheRef.current.getStats(),
      memory: memoryManagerRef.current.getStats(),
      parallel: parallelProcessorRef.current?.getStats() || null,
      progressive: progressiveLoaderRef.current?.getProgress() || null
    };
  }, []);

  return {
    ...state,
    startStreaming,
    stopStreaming,
    playAudio,
    pauseAudio,
    stopAudio,
    seekTo,
    retryStreaming,
    reset,
    getPerformanceStats,
    // Computed properties for better UX
    canPlay: state.audioChunks.length > 0 && !state.isLoading && !state.error,
    hasAudio: state.audioChunks.length > 0,
    isProcessing: state.isLoading || state.isStreaming,
  };
}

/**
 * Convert base64 string to ArrayBuffer with proper error handling
 * @param base64 Base64 encoded string
 * @returns ArrayBuffer containing the decoded data
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    console.error("[STREAMING_TTS] Failed to decode base64 audio data:", error);
    throw new Error("Failed to decode audio data");
  }
}
