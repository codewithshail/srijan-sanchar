"use client";

/**
 * Audio Text Sync Player Component
 * 
 * Combines audio playback with synchronized text highlighting.
 * Provides a unified experience for listening to stories while
 * following along with the text.
 * 
 * Requirements: 8.6
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
  RotateCcw,
  Type,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HighlightedStoryContent } from "@/components/highlighted-story-content";
import { useAudioTextHighlight } from "@/hooks/use-audio-text-highlight";

interface AudioTextSyncPlayerProps {
  /** Story content for highlighting */
  storyContent: string;
  /** Audio URL to play */
  audioUrl: string;
  /** Total duration in seconds (optional, will be detected from audio) */
  totalDuration?: number;
  /** Whether to show the text content */
  showContent?: boolean;
  /** Callback when playback starts */
  onPlaybackStart?: () => void;
  /** Callback when playback ends */
  onPlaybackEnd?: () => void;
  /** Additional class name */
  className?: string;
}

/**
 * Audio Text Sync Player
 * 
 * Provides synchronized audio playback with text highlighting
 */
export function AudioTextSyncPlayer({
  storyContent,
  audioUrl,
  totalDuration: initialDuration,
  showContent = true,
  onPlaybackStart,
  onPlaybackEnd,
  className,
}: AudioTextSyncPlayerProps) {
  // Audio element ref
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Highlighting state
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const [showTextContent, setShowTextContent] = useState(showContent);
  
  // Text highlight hook for segment navigation (used for click-to-seek)
  useAudioTextHighlight({
    text: storyContent,
    enabled: highlightEnabled,
  });

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => {
      setIsLoading(false);
      setDuration(audio.duration);
    };
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      onPlaybackEnd?.();
    };
    const handlePlay = () => {
      setIsPlaying(true);
      onPlaybackStart?.();
    };
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setIsLoading(false);
      setIsPlaying(false);
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
  }, [onPlaybackStart, onPlaybackEnd]);

  // Update playback speed
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Playback controls
  const handlePlayPause = useCallback(async () => {
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
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;

    const newTime = (value[0] / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleSkip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [currentTime, duration]);

  const handleVolumeChange = useCallback((value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = value[0] / 100;
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const handleMuteToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const handleReset = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);
  }, []);

  // Handle segment click from highlighted content
  const handleSegmentClick = useCallback((segmentIndex: number, estimatedTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Seek to the estimated time for this segment
    audio.currentTime = estimatedTime;
    setCurrentTime(estimatedTime);
  }, []);

  // Format time helper
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return "0:00";
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {/* Audio Element */}
        <audio ref={audioRef} src={audioUrl} preload="metadata" />

        {/* Player Controls Card */}
        <Card>
          <CardContent className="p-4">
            {/* Header with highlighting toggle */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Badge>
                {playbackSpeed !== 1 && (
                  <Badge variant="secondary" className="text-xs">
                    {playbackSpeed}x
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {/* Text visibility toggle */}
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setShowTextContent(!showTextContent)}
                      >
                        {showTextContent ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showTextContent ? "Hide text" : "Show text"}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Highlighting toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="highlight-toggle"
                    checked={highlightEnabled}
                    onCheckedChange={setHighlightEnabled}
                    disabled={!showTextContent}
                  />
                  <Label
                    htmlFor="highlight-toggle"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    <Type className="h-3 w-3 inline mr-1" />
                    Highlight
                  </Label>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <Slider
                value={[progress]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="w-full"
                disabled={isLoading}
              />
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

              {/* Previous */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleReset}
                    disabled={isLoading}
                    className="h-9 w-9"
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restart</TooltipContent>
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

              {/* Skip Forward */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleSkip(30)}
                    disabled={isLoading}
                    className="h-9 w-9"
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Skip forward 30s</TooltipContent>
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

            {/* Volume and Speed Controls */}
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

              {/* Speed Control */}
              <div className="flex items-center gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <Button
                    key={speed}
                    variant={playbackSpeed === speed ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPlaybackSpeed(speed)}
                    className="h-7 px-2 text-xs"
                  >
                    {speed}x
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Highlighted Story Content */}
        {showTextContent && storyContent && (
          <Card>
            <CardContent className="p-6">
              <HighlightedStoryContent
                content={storyContent}
                currentTime={currentTime}
                isPlaying={isPlaying}
                highlightEnabled={highlightEnabled}
                wordsPerMinute={150 * playbackSpeed} // Adjust for playback speed
                onSegmentClick={handleSegmentClick}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

export default AudioTextSyncPlayer;
