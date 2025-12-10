"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Languages,
  Clock,
  ListMusic,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Audio Chapter interface matching the database schema
 */
export interface AudioChapter {
  chapterIndex: number;
  audioUrl: string;
  duration: number;
  startPosition: number;
  endPosition: number;
  language: string;
}

/**
 * Supported language for audio
 */
export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

/**
 * Playback position state for persistence
 */
interface PlaybackPosition {
  storyId: string;
  chapterIndex: number;
  currentTime: number;
  language: string;
  timestamp: number;
}

/**
 * Props for the ChapterAudioPlayer component
 */
interface ChapterAudioPlayerProps {
  storyId: string;
  chapters: AudioChapter[];
  availableLanguages: SupportedLanguage[];
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
  onChapterChange?: (chapterIndex: number) => void;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  /** Callback for time updates - used for text highlighting sync */
  onTimeUpdate?: (currentTime: number, isPlaying: boolean, chapterIndex: number) => void;
  className?: string;
  compact?: boolean;
}

// Playback speed options
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Local storage key for playback position
const PLAYBACK_POSITION_KEY = "audio-playback-position";

/**
 * Get saved playback position from localStorage
 */
function getSavedPlaybackPosition(storyId: string): PlaybackPosition | null {
  if (typeof window === "undefined") return null;
  
  try {
    const saved = localStorage.getItem(`${PLAYBACK_POSITION_KEY}-${storyId}`);
    if (saved) {
      const position = JSON.parse(saved) as PlaybackPosition;
      // Only return if saved within last 7 days
      if (Date.now() - position.timestamp < 7 * 24 * 60 * 60 * 1000) {
        return position;
      }
    }
  } catch (error) {
    console.error("[AUDIO_PLAYER] Failed to load playback position:", error);
  }
  return null;
}

/**
 * Save playback position to localStorage
 */
function savePlaybackPosition(position: PlaybackPosition): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(
      `${PLAYBACK_POSITION_KEY}-${position.storyId}`,
      JSON.stringify(position)
    );
  } catch (error) {
    console.error("[AUDIO_PLAYER] Failed to save playback position:", error);
  }
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}


/**
 * ChapterAudioPlayer Component
 * 
 * A comprehensive audio player with chapter navigation, playback controls,
 * speed control, language selection, and playback position persistence.
 * 
 * Requirements: 8.1, 8.4, 8.5, 8.7
 */
export function ChapterAudioPlayer({
  storyId,
  chapters,
  availableLanguages,
  currentLanguage,
  onLanguageChange,
  onChapterChange,
  onPlaybackStart,
  onPlaybackEnd,
  onTimeUpdate,
  className,
  compact = false,
}: ChapterAudioPlayerProps) {
  // Audio element ref
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showChapterList, setShowChapterList] = useState(false);
  
  // Calculate total duration across all chapters
  const totalDuration = chapters.reduce((sum, ch) => sum + ch.duration, 0);
  
  // Get current chapter
  const currentChapter = chapters[currentChapterIndex];
  
  // Calculate global progress (across all chapters)
  const getGlobalProgress = useCallback(() => {
    if (chapters.length === 0) return 0;
    
    let elapsed = 0;
    for (let i = 0; i < currentChapterIndex; i++) {
      elapsed += chapters[i].duration;
    }
    elapsed += currentTime;
    
    return totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
  }, [chapters, currentChapterIndex, currentTime, totalDuration]);
  
  // Calculate chapter markers for progress bar
  const chapterMarkers = React.useMemo(() => {
    if (chapters.length <= 1) return [];
    
    const markers: { position: number; index: number }[] = [];
    let accumulated = 0;
    
    for (let i = 0; i < chapters.length - 1; i++) {
      accumulated += chapters[i].duration;
      markers.push({
        position: (accumulated / totalDuration) * 100,
        index: i + 1,
      });
    }
    
    return markers;
  }, [chapters, totalDuration]);

  // Load saved playback position on mount
  useEffect(() => {
    const savedPosition = getSavedPlaybackPosition(storyId);
    if (savedPosition && savedPosition.language === currentLanguage) {
      // Find the chapter
      const chapterExists = chapters.some(
        (ch) => ch.chapterIndex === savedPosition.chapterIndex
      );
      if (chapterExists) {
        setCurrentChapterIndex(savedPosition.chapterIndex);
        // We'll seek to the position after the audio loads
      }
    }
  }, [storyId, currentLanguage, chapters]);

  // Save playback position periodically
  useEffect(() => {
    if (!isPlaying) return;
    
    const saveInterval = setInterval(() => {
      savePlaybackPosition({
        storyId,
        chapterIndex: currentChapterIndex,
        currentTime,
        language: currentLanguage,
        timestamp: Date.now(),
      });
    }, 5000); // Save every 5 seconds
    
    return () => clearInterval(saveInterval);
  }, [isPlaying, storyId, currentChapterIndex, currentTime, currentLanguage]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setDuration(audio.duration);
      
      // Restore saved position if this is the initial load
      const savedPosition = getSavedPlaybackPosition(storyId);
      if (
        savedPosition &&
        savedPosition.chapterIndex === currentChapterIndex &&
        savedPosition.language === currentLanguage &&
        savedPosition.currentTime > 0
      ) {
        audio.currentTime = savedPosition.currentTime;
        setCurrentTime(savedPosition.currentTime);
      }
    };
    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      // Calculate global time across all chapters for text highlighting
      let globalTime = 0;
      for (let i = 0; i < currentChapterIndex; i++) {
        globalTime += chapters[i].duration;
      }
      globalTime += time;
      onTimeUpdate?.(globalTime, !audio.paused, currentChapterIndex);
    };
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => {
      // Auto-advance to next chapter
      if (currentChapterIndex < chapters.length - 1) {
        setCurrentChapterIndex((prev) => prev + 1);
      } else {
        // End of all chapters
        setIsPlaying(false);
        onPlaybackEnd?.();
        // Clear saved position when completed
        if (typeof window !== "undefined") {
          localStorage.removeItem(`${PLAYBACK_POSITION_KEY}-${storyId}`);
        }
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      onPlaybackStart?.();
    };
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
      toast.error("Failed to load audio chapter");
    };

    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [storyId, currentChapterIndex, currentLanguage, chapters, onPlaybackStart, onPlaybackEnd, onTimeUpdate]);

  // Load new chapter when index changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentChapter) return;

    audio.src = currentChapter.audioUrl;
    audio.playbackRate = playbackSpeed;
    setCurrentTime(0);
    
    // Auto-play if was playing
    if (isPlaying) {
      audio.play().catch(console.error);
    }
    
    onChapterChange?.(currentChapterIndex);
  }, [currentChapterIndex, currentChapter, playbackSpeed, onChapterChange]);

  // Update playback speed
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Playback controls
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
      console.error("Playback error:", error);
      toast.error("Failed to play audio");
    }
  };

  const handlePreviousChapter = () => {
    if (currentTime > 3) {
      // If more than 3 seconds into chapter, restart current chapter
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
    } else if (currentChapterIndex > 0) {
      setCurrentChapterIndex((prev) => prev - 1);
    }
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex((prev) => prev + 1);
    }
  };

  const handleGlobalSeek = (value: number[]) => {
    // Seek across all chapters
    const targetTime = (value[0] / 100) * totalDuration;
    
    let accumulated = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (accumulated + chapters[i].duration > targetTime) {
        setCurrentChapterIndex(i);
        const chapterTime = targetTime - accumulated;
        
        // Wait for chapter to load, then seek
        setTimeout(() => {
          const audio = audioRef.current;
          if (audio) {
            audio.currentTime = chapterTime;
            setCurrentTime(chapterTime);
          }
        }, 100);
        break;
      }
      accumulated += chapters[i].duration;
    }
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
      audio.volume = volume || 0.5;
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

  const handleChapterSelect = (index: number) => {
    setCurrentChapterIndex(index);
    setShowChapterList(false);
  };

  if (chapters.length === 0) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="text-center text-muted-foreground">
          No audio chapters available
        </div>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={cn("overflow-hidden", className)}>
        <audio ref={audioRef} preload="metadata" playsInline />
        
        <CardContent className={cn("p-4", compact && "p-3")}>
          {/* Header with language selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Chapter {currentChapterIndex + 1} of {chapters.length}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Language Selector */}
              {availableLanguages.length > 1 && (
                <Select value={currentLanguage} onValueChange={onLanguageChange}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <Languages className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableLanguages.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="text-xs">
                          {lang.nativeName} ({lang.name})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Speed Control */}
              <Select
                value={playbackSpeed.toString()}
                onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}
              >
                <SelectTrigger className="w-[70px] h-8 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <SelectItem key={speed} value={speed.toString()}>
                      {speed}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Global Progress Bar with Chapter Markers */}
          <div className="relative mb-4">
            <Slider
              value={[getGlobalProgress()]}
              onValueChange={handleGlobalSeek}
              max={100}
              step={0.1}
              className="w-full"
              disabled={isLoading}
            />
            
            {/* Chapter markers */}
            {chapterMarkers.map((marker) => (
              <Tooltip key={marker.index}>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-primary/50 rounded cursor-pointer hover:bg-primary transition-colors"
                    style={{ left: `${marker.position}%` }}
                    onClick={() => handleChapterSelect(marker.index)}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Chapter {marker.index + 1}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            
            {/* Time display */}
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{formatTime(chapters.slice(0, currentChapterIndex).reduce((s, c) => s + c.duration, 0) + currentTime)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {/* Skip Back 10s */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSkip(-10)}
                  disabled={isLoading}
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skip back 10s</TooltipContent>
            </Tooltip>

            {/* Previous Chapter */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePreviousChapter}
                  disabled={isLoading || (currentChapterIndex === 0 && currentTime < 3)}
                  className="h-9 w-9"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous chapter</TooltipContent>
            </Tooltip>

            {/* Play/Pause */}
            <Button
              variant="default"
              size="icon"
              onClick={handlePlayPause}
              disabled={isLoading}
              className="h-12 w-12 rounded-full"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            {/* Next Chapter */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNextChapter}
                  disabled={isLoading || currentChapterIndex >= chapters.length - 1}
                  className="h-9 w-9"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next chapter</TooltipContent>
            </Tooltip>

            {/* Skip Forward 10s */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleSkip(10)}
                  disabled={isLoading}
                  className="h-8 w-8"
                >
                  <RotateCcw className="h-4 w-4 scale-x-[-1]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Skip forward 10s</TooltipContent>
            </Tooltip>
          </div>

          {/* Volume and Chapter List */}
          <div className="flex items-center justify-between">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMuteToggle}
                className="h-8 w-8"
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
                className="w-20"
              />
            </div>

            {/* Chapter List Toggle */}
            {chapters.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChapterList(!showChapterList)}
                className="text-xs"
              >
                <ListMusic className="h-4 w-4 mr-1" />
                Chapters
                {showChapterList ? (
                  <ChevronLeft className="h-3 w-3 ml-1" />
                ) : (
                  <ChevronRight className="h-3 w-3 ml-1" />
                )}
              </Button>
            )}
          </div>

          {/* Chapter List */}
          {showChapterList && chapters.length > 1 && (
            <div className="mt-4 border-t pt-4">
              <div className="max-h-48 overflow-y-auto space-y-1">
                {chapters.map((chapter, index) => (
                  <button
                    key={chapter.chapterIndex}
                    onClick={() => handleChapterSelect(index)}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-md text-sm transition-colors",
                      index === currentChapterIndex
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {index === currentChapterIndex && isPlaying ? (
                        <div className="w-4 h-4 flex items-center justify-center">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        </div>
                      ) : (
                        <span className="w-4 text-center text-muted-foreground">
                          {index + 1}
                        </span>
                      )}
                      <span>Chapter {index + 1}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(chapter.duration)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default ChapterAudioPlayer;
