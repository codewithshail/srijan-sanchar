"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  Play, 
  Pause, 
  Square, 
  Volume2, 
  VolumeX,
  RotateCcw,
  RotateCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface AudioPlayerProps {
  audioUrl?: string;
  audioData?: ArrayBuffer;
  title?: string;
  artist?: string;
  artwork?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onEnded?: () => void;
  className?: string;
}

export function AudioPlayer({ 
  audioUrl, 
  audioData, 
  title = "Audio Story",
  artist = "Story Reader",
  artwork,
  onPlay, 
  onPause, 
  onStop, 
  onEnded,
  className = ""
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [mediaSessionSupported, setMediaSessionSupported] = useState(false);

  // Check for Media Session API support
  useEffect(() => {
    setMediaSessionSupported('mediaSession' in navigator);
  }, []);

  // Create audio URL from ArrayBuffer if provided
  useEffect(() => {
    if (audioData && audioRef.current) {
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      audioRef.current.src = url;
      
      return () => {
        URL.revokeObjectURL(url);
      };
    } else if (audioUrl && audioRef.current) {
      audioRef.current.src = audioUrl;
    }
  }, [audioData, audioUrl]);

  // Setup Media Session API for background playback and device controls
  useEffect(() => {
    if (!mediaSessionSupported || !('mediaSession' in navigator)) return;

    // Set metadata for the media session
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: artist,
      artwork: artwork ? [
        { src: artwork, sizes: '96x96', type: 'image/png' },
        { src: artwork, sizes: '128x128', type: 'image/png' },
        { src: artwork, sizes: '192x192', type: 'image/png' },
        { src: artwork, sizes: '256x256', type: 'image/png' },
        { src: artwork, sizes: '384x384', type: 'image/png' },
        { src: artwork, sizes: '512x512', type: 'image/png' },
      ] : undefined,
    });

    // Set up action handlers for device controls
    navigator.mediaSession.setActionHandler('play', () => {
      handlePlayPause();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      handlePlayPause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      handleStop();
    });

    navigator.mediaSession.setActionHandler('seekbackward', () => {
      handleSkip(-10);
    });

    navigator.mediaSession.setActionHandler('seekforward', () => {
      handleSkip(10);
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
        setCurrentTime(details.seekTime);
      }
    });

    // Update position state for scrubbing support
    const updatePositionState = () => {
      if (duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1.0,
          position: currentTime,
        });
      }
    };

    updatePositionState();

    return () => {
      // Clear action handlers when component unmounts
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('stop', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, [title, artist, artwork, duration, currentTime, mediaSessionSupported]);

  // Update Media Session playback state
  useEffect(() => {
    if (mediaSessionSupported && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying, mediaSessionSupported]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      // Update position state when audio is ready
      if (mediaSessionSupported && 'mediaSession' in navigator && audio.duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: 1.0,
          position: audio.currentTime,
        });
      }
    };
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Update position state for scrubbing support
      if (mediaSessionSupported && 'mediaSession' in navigator && audio.duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: 1.0,
          position: audio.currentTime,
        });
      }
    };
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      if (mediaSessionSupported && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      onEnded?.();
    };
    const handlePlay = () => {
      setIsPlaying(true);
      if (mediaSessionSupported && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      onPlay?.();
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (mediaSessionSupported && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      onPause?.();
    };
    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      if (mediaSessionSupported && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
      toast.error("Failed to load audio");
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [onPlay, onPause, onEnded, mediaSessionSupported]);

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (isPlaying) {
        audio.pause();
      } else {
        await audio.play();
      }
    } catch (error) {
      console.error("Audio playback error:", error);
      toast.error("Failed to play audio");
    }
  };

  const handleStop = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    onStop?.();
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const newTime = (value[0] / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = value[0] / 100;
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const handleSkip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4 ${className}`}>
      <audio 
        ref={audioRef} 
        preload="metadata"
        // Enable background playback on mobile
        playsInline
        // Allow the audio to continue playing when the page is not visible
        onPlay={() => {
          // Request audio focus for background playback
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        }}
      />
      
      {/* Main Controls */}
      <div className="flex items-center justify-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSkip(-10)}
          disabled={!duration || isLoading}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="default"
          size="lg"
          onClick={handlePlayPause}
          disabled={!audioUrl && !audioData || isLoading}
          className="w-12 h-12 rounded-full"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleStop}
          disabled={!duration || isLoading}
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSkip(10)}
          disabled={!duration || isLoading}
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[progressPercentage]}
          onValueChange={handleSeek}
          max={100}
          step={0.1}
          className="w-full"
          disabled={!duration || isLoading}
        />
        <div className="flex justify-between text-sm text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMuteToggle}
            className="p-1"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            className="w-24"
          />
        </div>

        {/* Background playback indicator */}
        {mediaSessionSupported && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Background playback enabled
          </div>
        )}
      </div>
    </div>
  );
}