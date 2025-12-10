"use client";

/**
 * Multi-Language Audio Player Component
 * 
 * Provides a comprehensive audio player with:
 * - Language selection for TTS
 * - Audio generation in multiple Indian languages
 * - Client-side caching indicator
 * - Seamless language switching
 * 
 * Requirements: 8.5, 10.4
 */

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Languages,
  Headphones,
  Loader2,
  Check,
  Download,
  Trash2,
  Plus,
  HardDrive,
  Cloud,
  MoreVertical,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChapterAudioPlayer } from "@/components/chapter-audio-player";
import { useMultiLanguageAudio, type SupportedLanguage } from "@/hooks/use-multi-language-audio";

interface MultiLanguageAudioPlayerProps {
  storyId: string;
  isOwner?: boolean;
  className?: string;
}

/**
 * Format duration in seconds to human readable string
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Language status badge component
 */
function LanguageStatusBadge({
  hasServerAudio,
  hasCachedAudio,
  isGenerating,
}: {
  hasServerAudio: boolean;
  hasCachedAudio: boolean;
  isGenerating: boolean;
}) {
  if (isGenerating) {
    return (
      <Badge variant="secondary" className="text-xs">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Generating
      </Badge>
    );
  }

  if (hasCachedAudio) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs text-green-600 border-green-300">
            <HardDrive className="h-3 w-3 mr-1" />
            Cached
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Audio cached locally for offline playback</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (hasServerAudio) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-xs">
            <Cloud className="h-3 w-3 mr-1" />
            Available
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Audio available from server</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
}

/**
 * Language selector with status indicators
 */
function LanguageSelectorWithStatus({
  supportedLanguages,
  currentLanguage,
  onLanguageChange,
  getLanguageStatus,
  disabled,
}: {
  supportedLanguages: SupportedLanguage[];
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
  getLanguageStatus: (language: string) => {
    hasServerAudio: boolean;
    hasCachedAudio: boolean;
    isGenerating: boolean;
  };
  disabled?: boolean;
}) {
  const currentLang = supportedLanguages.find((l) => l.code === currentLanguage);

  return (
    <Select value={currentLanguage} onValueChange={onLanguageChange} disabled={disabled}>
      <SelectTrigger className="w-[220px]">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          <SelectValue>
            {currentLang ? (
              <span>
                {currentLang.nativeName} ({currentLang.name})
              </span>
            ) : (
              "Select language"
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {supportedLanguages.map((language) => {
          const status = getLanguageStatus(language.code);
          return (
            <SelectItem key={language.code} value={language.code}>
              <div className="flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{language.nativeName}</span>
                  <span className="text-sm text-muted-foreground">
                    {language.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {status.isGenerating && (
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  )}
                  {status.hasCachedAudio && (
                    <HardDrive className="h-3 w-3 text-green-600" />
                  )}
                  {status.hasServerAudio && !status.hasCachedAudio && (
                    <Cloud className="h-3 w-3 text-blue-500" />
                  )}
                  {(status.hasServerAudio || status.hasCachedAudio) && (
                    <Check className="h-3 w-3 text-green-600" />
                  )}
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/**
 * Multi-Language Audio Player Component
 */
export function MultiLanguageAudioPlayer({
  storyId,
  isOwner = false,
  className,
}: MultiLanguageAudioPlayerProps) {
  const [showLanguageManager, setShowLanguageManager] = useState(false);

  const {
    chapters,
    totalChapters,
    totalDuration,
    currentLanguage,
    availableLanguages,
    supportedLanguages,
    cachedLanguages,
    hasAudio,
    isLoading,
    isGenerating,
    isGeneratingLanguage,
    generatingLanguages,
    changeLanguage,
    generateAudio,
    generateAudioForLanguage,
    clearLanguageCache,
    getLanguageStatus,
    getLanguageName,
    hasAudioForLanguage,
  } = useMultiLanguageAudio({
    storyId,
    initialLanguage: "en-IN",
    autoFetch: true,
    enableCaching: true,
  });

  // Handle language change
  const handleLanguageChange = useCallback(
    (language: string) => {
      changeLanguage(language);
    },
    [changeLanguage]
  );

  // Handle generate audio for current language
  const handleGenerateAudio = useCallback(() => {
    generateAudio({
      speaker: "anushka",
      targetDuration: 60,
    });
  }, [generateAudio]);

  // Handle generate audio for specific language
  const handleGenerateForLanguage = useCallback(
    (language: string) => {
      generateAudioForLanguage(language, {
        speaker: "anushka",
        targetDuration: 60,
      });
    },
    [generateAudioForLanguage]
  );

  // Languages without audio
  const languagesWithoutAudio = useMemo(() => {
    return supportedLanguages.filter(
      (lang) => !hasAudioForLanguage(lang.code) && !isGeneratingLanguage(lang.code)
    );
  }, [supportedLanguages, hasAudioForLanguage, isGeneratingLanguage]);

  // Current language status
  const currentStatus = getLanguageStatus(currentLanguage);

  if (isLoading && !hasAudio) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Headphones className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Listen to Story</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {hasAudio
                    ? `${totalChapters} chapters • ${formatDuration(totalDuration)}`
                    : "Generate audio in your preferred language"}
                </p>
              </div>
            </div>

            {/* Language status badge */}
            <LanguageStatusBadge
              hasServerAudio={currentStatus.hasServerAudio}
              hasCachedAudio={currentStatus.hasCachedAudio}
              isGenerating={currentStatus.isGenerating}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Language Selection Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <LanguageSelectorWithStatus
              supportedLanguages={supportedLanguages}
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
              getLanguageStatus={getLanguageStatus}
              disabled={isGenerating}
            />

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Generate button for current language */}
              {!hasAudio && !currentStatus.isGenerating && isOwner && (
                <Button
                  onClick={handleGenerateAudio}
                  disabled={isGenerating}
                  size="sm"
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  Generate Audio
                </Button>
              )}

              {/* More options dropdown */}
              {isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Audio Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {/* Generate for other languages */}
                    {languagesWithoutAudio.length > 0 && (
                      <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                          Generate for language
                        </DropdownMenuLabel>
                        {languagesWithoutAudio.slice(0, 5).map((lang) => (
                          <DropdownMenuItem
                            key={lang.code}
                            onClick={() => handleGenerateForLanguage(lang.code)}
                            disabled={isGeneratingLanguage(lang.code)}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {lang.nativeName}
                            {isGeneratingLanguage(lang.code) && (
                              <Loader2 className="h-3 w-3 ml-auto animate-spin" />
                            )}
                          </DropdownMenuItem>
                        ))}
                        {languagesWithoutAudio.length > 5 && (
                          <DropdownMenuItem
                            onClick={() => setShowLanguageManager(true)}
                          >
                            <Languages className="h-4 w-4 mr-2" />
                            More languages...
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Cache management */}
                    {cachedLanguages.length > 0 && (
                      <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                          Cached ({cachedLanguages.length} languages)
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => clearLanguageCache(currentLanguage)}
                          disabled={!cachedLanguages.includes(currentLanguage)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear {getLanguageName(currentLanguage)} cache
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => clearLanguageCache()}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Clear all cached audio
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Generation progress */}
          {generatingLanguages.length > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Generating audio for:{" "}
                  {generatingLanguages.map(getLanguageName).join(", ")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a few minutes. You can continue browsing.
              </p>
            </div>
          )}

          {/* Audio Player */}
          {hasAudio ? (
            <ChapterAudioPlayer
              storyId={storyId}
              chapters={chapters}
              availableLanguages={
                availableLanguages.length > 0
                  ? availableLanguages
                  : supportedLanguages
              }
              currentLanguage={currentLanguage}
              onLanguageChange={handleLanguageChange}
            />
          ) : (
            !currentStatus.isGenerating && (
              <div className="text-center py-6 text-muted-foreground">
                <Volume2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  No audio available for {getLanguageName(currentLanguage)}
                </p>
                {isOwner ? (
                  <p className="text-xs mt-1">
                    Click "Generate Audio" to create audio narration
                  </p>
                ) : (
                  <p className="text-xs mt-1">
                    Audio has not been generated for this language yet
                  </p>
                )}
              </div>
            )
          )}

          {/* Available languages indicator */}
          {availableLanguages.length > 1 && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Available in:
              </span>
              <div className="flex flex-wrap gap-1">
                {availableLanguages.map((lang) => (
                  <Badge
                    key={lang.code}
                    variant={lang.code === currentLanguage ? "default" : "outline"}
                    className="text-xs cursor-pointer"
                    onClick={() => handleLanguageChange(lang.code)}
                  >
                    {lang.nativeName}
                    {cachedLanguages.includes(lang.code) && (
                      <HardDrive className="h-2.5 w-2.5 ml-1" />
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default MultiLanguageAudioPlayer;
