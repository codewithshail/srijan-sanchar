'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';

interface SequentialAudioPlayer {
  loadChunks(chunks: ArrayBuffer[]): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  seekTo(position: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  onProgress(callback: (progress: number) => void): void;
  onComplete(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
}

class WebAudioSequentialPlayer implements SequentialAudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioBuffers: AudioBuffer[] = [];
  private currentChunkIndex: number = 0;
  private currentSource: AudioBufferSourceNode | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPlaying: boolean = false;
  private progressCallback?: (progress: number) => void;
  private completeCallback?: () => void;
  private errorCallback?: (error: Error) => void;
  private progressInterval?: NodeJS.Timeout;

  constructor() {
    // Initialize audio context lazily to avoid issues with autoplay policies
  }

  private async initializeAudioContext(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async loadChunks(chunks: ArrayBuffer[]): Promise<void> {
    try {
      await this.initializeAudioContext();
      
      this.audioBuffers = [];
      
      for (let i = 0; i < chunks.length; i++) {
        try {
          // Create a copy of the ArrayBuffer to avoid detached buffer issues
          const chunkCopy = chunks[i].slice(0);
          const audioBuffer = await this.audioContext!.decodeAudioData(chunkCopy);
          this.audioBuffers.push(audioBuffer);
        } catch (error) {
          console.error(`[AUDIO_PLAYER] Failed to decode audio chunk ${i}:`, error);
          if (this.errorCallback) {
            this.errorCallback(new Error(`Failed to decode audio chunk ${i}: ${error}`));
          }
          throw error;
        }
      }
      
      console.log(`[AUDIO_PLAYER] Successfully loaded ${this.audioBuffers.length} audio chunks`);
    } catch (error) {
      console.error('[AUDIO_PLAYER] Failed to load audio chunks:', error);
      throw error;
    }
  }

  async play(): Promise<void> {
    try {
      if (this.audioBuffers.length === 0) {
        throw new Error('No audio chunks loaded');
      }

      await this.initializeAudioContext();
      
      this.isPlaying = true;
      this.startTime = this.audioContext!.currentTime - this.pauseTime;
      
      // Start progress tracking
      this.startProgressTracking();
      
      await this.playChunk(this.currentChunkIndex);
    } catch (error) {
      console.error('[AUDIO_PLAYER] Failed to start playback:', error);
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
      throw error;
    }
  }

  private async playChunk(index: number): Promise<void> {
    if (index >= this.audioBuffers.length || !this.isPlaying) {
      this.onPlaybackComplete();
      return;
    }

    try {
      const buffer = this.audioBuffers[index];
      const source = this.audioContext!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext!.destination);

      this.currentSource = source;
      this.currentChunkIndex = index;

      source.onended = () => {
        if (this.isPlaying && this.currentSource === source) {
          // Move to next chunk seamlessly
          this.playChunk(index + 1);
        }
      };

      source.start();
      console.log(`[AUDIO_PLAYER] Started playing chunk ${index + 1}/${this.audioBuffers.length}`);
    } catch (error) {
      console.error(`[AUDIO_PLAYER] Failed to play chunk ${index}:`, error);
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
    }
  }

  pause(): void {
    this.isPlaying = false;
    this.pauseTime = this.getCurrentTime();
    
    this.stopProgressTracking();
    
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    
    console.log('[AUDIO_PLAYER] Playback paused');
  }

  stop(): void {
    this.isPlaying = false;
    this.pauseTime = 0;
    this.currentChunkIndex = 0;
    
    this.stopProgressTracking();
    
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    
    console.log('[AUDIO_PLAYER] Playback stopped');
  }

  seekTo(position: number): void {
    const totalDuration = this.getDuration();
    const targetTime = Math.max(0, Math.min(position, totalDuration));
    
    // Find which chunk contains the target time
    let accumulatedTime = 0;
    let targetChunkIndex = 0;
    
    for (let i = 0; i < this.audioBuffers.length; i++) {
      const chunkDuration = this.audioBuffers[i].duration;
      if (accumulatedTime + chunkDuration > targetTime) {
        targetChunkIndex = i;
        break;
      }
      accumulatedTime += chunkDuration;
    }
    
    const wasPlaying = this.isPlaying;
    
    // Stop current playback
    if (this.isPlaying) {
      this.pause();
    }
    
    // Update position
    this.currentChunkIndex = targetChunkIndex;
    this.pauseTime = targetTime;
    
    // Resume if was playing
    if (wasPlaying) {
      this.play();
    }
    
    console.log(`[AUDIO_PLAYER] Seeked to ${targetTime.toFixed(2)}s (chunk ${targetChunkIndex})`);
  }

  getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.pauseTime;
    }
    
    if (!this.audioContext) {
      return 0;
    }
    
    // Calculate elapsed time from completed chunks
    let elapsed = 0;
    for (let i = 0; i < this.currentChunkIndex; i++) {
      elapsed += this.audioBuffers[i].duration;
    }
    
    // Add time from current chunk
    const currentChunkElapsed = this.audioContext.currentTime - this.startTime - elapsed;
    return elapsed + Math.max(0, currentChunkElapsed);
  }

  getDuration(): number {
    return this.audioBuffers.reduce((total, buffer) => total + buffer.duration, 0);
  }

  private startProgressTracking(): void {
    this.stopProgressTracking();
    
    this.progressInterval = setInterval(() => {
      if (this.isPlaying && this.progressCallback) {
        const totalDuration = this.getDuration();
        const currentTime = this.getCurrentTime();
        const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
        
        this.progressCallback(Math.min(100, Math.max(0, progress)));
      }
    }, 100); // Update every 100ms for smooth progress
  }

  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = undefined;
    }
  }

  private onPlaybackComplete(): void {
    this.isPlaying = false;
    this.pauseTime = 0;
    this.currentChunkIndex = 0;
    
    this.stopProgressTracking();
    
    console.log('[AUDIO_PLAYER] Playback completed');
    
    if (this.completeCallback) {
      this.completeCallback();
    }
  }

  onProgress(callback: (progress: number) => void): void {
    this.progressCallback = callback;
  }

  onComplete(callback: () => void): void {
    this.completeCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  // Cleanup method
  dispose(): void {
    this.stop();
    this.stopProgressTracking();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioBuffers = [];
    this.progressCallback = undefined;
    this.completeCallback = undefined;
    this.errorCallback = undefined;
  }
}

interface SequentialAudioPlayerProps {
  audioChunks: ArrayBuffer[];
  onPlaybackComplete?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export function SequentialAudioPlayerComponent({
  audioChunks,
  onPlaybackComplete,
  onError,
  className = ''
}: SequentialAudioPlayerProps) {
  const playerRef = useRef<WebAudioSequentialPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize player
  useEffect(() => {
    playerRef.current = new WebAudioSequentialPlayer();
    
    const player = playerRef.current;
    
    player.onProgress((progressPercent) => {
      setProgress(progressPercent);
      if (player) {
        setCurrentTime(player.getCurrentTime());
      }
    });
    
    player.onComplete(() => {
      setIsPlaying(false);
      setProgress(100);
      onPlaybackComplete?.();
    });
    
    player.onError((err) => {
      setError(err.message);
      setIsPlaying(false);
      onError?.(err);
    });
    
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
      }
    };
  }, [onPlaybackComplete, onError]);

  // Load audio chunks when they change
  useEffect(() => {
    if (audioChunks.length > 0 && playerRef.current) {
      setIsLoading(true);
      setError(null);
      
      playerRef.current.loadChunks(audioChunks)
        .then(() => {
          if (playerRef.current) {
            setDuration(playerRef.current.getDuration());
          }
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setIsLoading(false);
        });
    }
  }, [audioChunks]);

  const handlePlay = useCallback(async () => {
    if (!playerRef.current || isLoading) return;
    
    try {
      setError(null);
      await playerRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [isLoading]);

  const handlePause = useCallback(() => {
    if (!playerRef.current) return;
    
    playerRef.current.pause();
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    if (!playerRef.current) return;
    
    playerRef.current.stop();
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    if (!playerRef.current || duration === 0) return;
    
    const targetTime = (value[0] / 100) * duration;
    playerRef.current.seekTo(targetTime);
    setCurrentTime(targetTime);
    setProgress(value[0]);
  }, [duration]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canPlay = audioChunks.length > 0 && !isLoading && !error;

  return (
    <div className={`space-y-4 ${className}`}>
      {error && (
        <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
          Error: {error}
        </div>
      )}
      
      <div className="flex items-center space-x-2">
        <Button
          onClick={isPlaying ? handlePause : handlePlay}
          disabled={!canPlay}
          size="sm"
          variant="outline"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        
        <Button
          onClick={handleStop}
          disabled={!canPlay}
          size="sm"
          variant="outline"
        >
          <Square className="w-4 h-4" />
        </Button>
        
        <Button
          onClick={() => handleSeek([0])}
          disabled={!canPlay}
          size="sm"
          variant="outline"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="space-y-2">
        <Progress 
          value={progress} 
          className="w-full cursor-pointer"
          onClick={(e) => {
            if (!canPlay) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = (x / rect.width) * 100;
            handleSeek([Math.max(0, Math.min(100, percentage))]);
          }}
        />
        
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      {audioChunks.length > 0 && (
        <div className="text-xs text-gray-500">
          {audioChunks.length} audio chunk{audioChunks.length !== 1 ? 's' : ''} loaded
        </div>
      )}
    </div>
  );
}

export { WebAudioSequentialPlayer, SequentialAudioPlayerComponent as SequentialAudioPlayer };
export type { SequentialAudioPlayer as SequentialAudioPlayerInterface };