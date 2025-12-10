"use client";

import React, { useState, useCallback } from "react";
import { Button, LoadingButton } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Headphones, Languages, Wand2, ListMusic, Loader2, Type } from "lucide-react";
import { toast } from "sonner";
import { ChapterAudioPlayer } from "@/components/chapter-audio-player";
import { SequentialAudioPlayer } from "@/components/sequential-audio-player";
import { LanguageSelector } from "@/components/language-selector";
import { useMultiLanguageAudio } from "@/hooks/use-multi-language-audio";
import { useStreamingTTS } from "@/hooks/use-streaming-tts";

interface StoryAudioSectionProps {
  storyId: string;
  storyContent: string;
  storyStatus: string;
  isOwner?: boolean;
  className?: string;
  /** Callback for audio time updates - used for text highlighting */
  onAudioTimeUpdate?: (currentTime: number, isPlaying: boolean) => void;
  /** Whether text highlighting is enabled */
  highlightEnabled?: boolean;
  /** Callback to toggle text highlighting */
  onHighlightToggle?: (enabled: boolean) => void;
}

/**
 * StoryAudioSection Component
 * 
 * Provides a unified audio experience with two modes:
 * 1. Pre-generated chapter-based audio (if available)
 * 2. On-demand streaming TTS generation
 * 
 * Requirements: 8.1, 8.4, 8.5, 8.7
 */
export function StoryAudioSection({
  storyId,
  storyContent,
  storyStatus,
  isOwner = false,
  className,
  onAudioTimeUpdate,
  highlightEnabled = false,
  onHighlightToggle,
}: StoryAudioSectionProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("en-IN");
  const [activeTab, setActiveTab] = useState<"chapters" | "stream">("chapters");
  
  // Hook for multi-language audio with caching
  const audioChapters = useMultiLanguageAudio({
    storyId,
    initialLanguage: selectedLanguage,
    autoFetch: true,
    enableCaching: true,
  });
  
  // Hook for streaming TTS
  const streamingTTS = useStreamingTTS();

  // Clean text for TTS
  const cleanTextForTTS = useCallback((text: string): string => {
    if (!text) return "";
    // Remove HTML tags
    const withoutTags = text.replace(/<[^>]*>/g, " ");
    // Remove markdown formatting
    const withoutMarkdown = withoutTags
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    // Normalize whitespace
    const normalized = withoutMarkdown.replace(/\s+/g, " ");
    return normalized.trim();
  }, []);

  // Handle language change
  const handleLanguageChange = useCallback(
    async (language: string) => {
      setSelectedLanguage(language);
      await audioChapters.changeLanguage(language);
    },
    [audioChapters]
  );

  // Generate audio chapters (pre-generated)
  const handleGenerateChapters = useCallback(() => {
    audioChapters.generateAudio({
      speaker: "anushka",
      targetDuration: 60,
    });
  }, [audioChapters]);

  // Generate streaming audio
  const handleGenerateStream = useCallback(async () => {
    const cleanText = cleanTextForTTS(storyContent);
    
    if (!cleanText || cleanText.length < 10) {
      toast.error("No content available for audio generation");
      return;
    }

    try {
      await streamingTTS.startStreaming({
        text: cleanText,
        language: selectedLanguage,
        speaker: "anushka",
        pitch: 0,
        pace: 1.0,
      });

      // Track listen event
      if (storyStatus === "published") {
        fetch(`/api/stories/${storyId}/analytics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "listen",
            languageCode: selectedLanguage,
          }),
        }).catch(() => {});
      }
    } catch (error) {
      console.error("TTS generation error:", error);
      toast.error("Failed to generate audio. Please try again.");
    }
  }, [storyContent, selectedLanguage, storyId, storyStatus, cleanTextForTTS, streamingTTS]);

  // Track playback start for analytics
  const handlePlaybackStart = useCallback(() => {
    if (storyStatus === "published") {
      fetch(`/api/stories/${storyId}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "listen",
          languageCode: selectedLanguage,
        }),
      }).catch(() => {});
    }
  }, [storyId, storyStatus, selectedLanguage]);

  // Handle audio time updates for text highlighting
  const handleAudioTimeUpdate = useCallback(
    (currentTime: number, isPlaying: boolean) => {
      onAudioTimeUpdate?.(currentTime, isPlaying);
    },
    [onAudioTimeUpdate]
  );

  // Determine if we have pre-generated chapters
  const hasChapters = audioChapters.hasAudio;
  const hasStreamingAudio = streamingTTS.audioChunks.length > 0;
  const hasCachedAudio = audioChapters.cachedLanguages.includes(selectedLanguage);

  // Auto-select tab based on available audio
  React.useEffect(() => {
    if (hasChapters) {
      setActiveTab("chapters");
    } else if (hasStreamingAudio) {
      setActiveTab("stream");
    }
  }, [hasChapters, hasStreamingAudio]);

  return (
    <section className={`p-4 md:p-6 bg-muted/30 rounded-xl border ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Headphones className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Listen to this story</h3>
            <p className="text-sm text-muted-foreground">
              {hasChapters
                ? `${audioChapters.totalChapters} chapters available${hasCachedAudio ? " (cached)" : ""}`
                : "Generate audio in multiple languages"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Text Highlighting Toggle */}
          {onHighlightToggle && (
            <div className="flex items-center gap-2">
              <Switch
                id="highlight-toggle"
                checked={highlightEnabled}
                onCheckedChange={onHighlightToggle}
              />
              <Label
                htmlFor="highlight-toggle"
                className="text-xs text-muted-foreground cursor-pointer hidden sm:flex items-center gap-1"
              >
                <Type className="h-3 w-3" />
                Highlight
              </Label>
            </div>
          )}

          {/* Language Selector */}
          <LanguageSelector
            value={selectedLanguage}
            onValueChange={handleLanguageChange}
            placeholder="Language"
          />
        </div>
      </div>

      {/* Audio Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chapters" | "stream")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="chapters" className="text-xs sm:text-sm">
            <ListMusic className="h-4 w-4 mr-1.5" />
            Chapters
            {hasChapters && (
              <Badge variant="secondary" className="ml-1.5 text-xs">
                {audioChapters.totalChapters}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stream" className="text-xs sm:text-sm">
            <Wand2 className="h-4 w-4 mr-1.5" />
            Quick Listen
          </TabsTrigger>
        </TabsList>

        {/* Pre-generated Chapters Tab */}
        <TabsContent value="chapters" className="mt-0">
          {audioChapters.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasChapters ? (
            <ChapterAudioPlayer
              storyId={storyId}
              chapters={audioChapters.chapters}
              availableLanguages={
                audioChapters.availableLanguages.length > 0
                  ? audioChapters.availableLanguages
                  : audioChapters.supportedLanguages
              }
              currentLanguage={selectedLanguage}
              onLanguageChange={handleLanguageChange}
              onPlaybackStart={handlePlaybackStart}
              onTimeUpdate={handleAudioTimeUpdate}
            />
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-4">
                No pre-generated audio chapters available for this language.
              </p>
              {isOwner && (
                <LoadingButton
                  onClick={handleGenerateChapters}
                  loading={audioChapters.isGenerating}
                  disabled={audioChapters.isGenerating}
                >
                  <ListMusic className="mr-2 h-4 w-4" />
                  {audioChapters.isGenerating
                    ? "Generating chapters..."
                    : "Generate Audio Chapters"}
                </LoadingButton>
              )}
              {!isOwner && (
                <p className="text-xs text-muted-foreground mt-2">
                  Try &quot;Quick Listen&quot; for on-demand audio generation.
                </p>
              )}
            </div>
          )}

          {/* Generation progress */}
          {audioChapters.isGenerating && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Generating audio for: {audioChapters.generatingLanguages.map(audioChapters.getLanguageName).join(", ")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a few minutes. You can continue browsing.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Streaming TTS Tab */}
        <TabsContent value="stream" className="mt-0">
          <div className="space-y-4">
            {/* Generate Button */}
            {!streamingTTS.isStreaming && streamingTTS.audioChunks.length === 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <LoadingButton
                  variant="default"
                  onClick={handleGenerateStream}
                  loading={streamingTTS.isLoading}
                  disabled={streamingTTS.isStreaming}
                  className="flex-1 sm:flex-none"
                >
                  <Languages className="mr-2 h-4 w-4" />
                  {streamingTTS.isLoading ? "Generating..." : "Generate Audio"}
                </LoadingButton>
                <p className="text-xs text-muted-foreground">
                  Generates audio on-demand using AI
                </p>
              </div>
            )}

            {/* Streaming Progress */}
            {streamingTTS.isStreaming && (
              <div>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>Generating audio...</span>
                  <span>{Math.round(streamingTTS.progress)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${streamingTTS.progress}%` }}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={streamingTTS.stopStreaming}
                  className="mt-2"
                >
                  Stop
                </Button>
              </div>
            )}

            {/* Audio Player */}
            {streamingTTS.audioChunks.length > 0 && (
              <div>
                <SequentialAudioPlayer
                  audioChunks={streamingTTS.audioChunks}
                  onPlaybackComplete={() => {}}
                  onError={() => {}}
                />
                
                {/* Reset button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={streamingTTS.reset}
                  className="mt-2"
                >
                  Generate New Audio
                </Button>
              </div>
            )}

            {/* Error display */}
            {streamingTTS.error && (
              <p className="text-destructive text-sm">{streamingTTS.error}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

export default StoryAudioSection;
