"use client";

/**
 * Multi-Language Audio Hook
 * 
 * Provides comprehensive multi-language audio support including:
 * - Language selection for TTS
 * - Audio generation in multiple Indian languages
 * - Client-side caching using IndexedDB
 * - Seamless language switching
 * 
 * Requirements: 8.5, 10.4
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAudioLanguageCache, type CachedAudioChapter } from "@/lib/audio/audio-language-cache";

/**
 * Audio Chapter interface matching the API response
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
 * Audio chapters API response
 */
interface AudioChaptersResponse {
  storyId: string;
  chapters: AudioChapter[];
  totalChapters: number;
  totalDuration: number;
  language: string | null;
  availableLanguages: string[];
  supportedLanguages: SupportedLanguage[];
}

/**
 * Audio generation config
 */
interface AudioGenerationConfig {
  language?: string;
  speaker?: string;
  targetDuration?: number;
  pitch?: number;
  pace?: number;
  async?: boolean;
}

/**
 * Hook options
 */
interface UseMultiLanguageAudioOptions {
  storyId: string;
  initialLanguage?: string;
  autoFetch?: boolean;
  enableCaching?: boolean;
}

/**
 * Language audio status
 */
interface LanguageAudioStatus {
  language: string;
  hasServerAudio: boolean;
  hasCachedAudio: boolean;
  isGenerating: boolean;
}

/**
 * Hook for managing multi-language audio with caching
 */
export function useMultiLanguageAudio({
  storyId,
  initialLanguage = "en-IN",
  autoFetch = true,
  enableCaching = true,
}: UseMultiLanguageAudioOptions) {
  const queryClient = useQueryClient();
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  const [generatingLanguages, setGeneratingLanguages] = useState<Set<string>>(new Set());
  const [cachedLanguages, setCachedLanguages] = useState<string[]>([]);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(false);
  const cacheRef = useRef(enableCaching ? getAudioLanguageCache() : null);

  // Fetch audio chapters from server
  const {
    data: audioData,
    isLoading: isLoadingServer,
    error,
    refetch,
  } = useQuery<AudioChaptersResponse>({
    queryKey: ["audioChapters", storyId, currentLanguage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (currentLanguage) {
        params.set("language", currentLanguage);
      }
      
      const res = await fetch(
        `/api/stories/${storyId}/audio?${params.toString()}`
      );
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Story not found");
        }
        throw new Error("Failed to fetch audio chapters");
      }
      
      return res.json();
    },
    enabled: autoFetch && !!storyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Load cached languages on mount
  useEffect(() => {
    if (!enableCaching || !cacheRef.current) return;

    const loadCachedLanguages = async () => {
      try {
        const languages = await cacheRef.current!.getCachedLanguages(storyId);
        setCachedLanguages(languages);
      } catch (error) {
        console.error("[MULTI_LANG_AUDIO] Error loading cached languages:", error);
      }
    };

    loadCachedLanguages();
  }, [storyId, enableCaching]);

  // Cache audio chapters when fetched from server
  useEffect(() => {
    if (!enableCaching || !cacheRef.current || !audioData?.chapters?.length) return;

    const cacheChapters = async () => {
      try {
        // Check if already cached
        const isCached = await cacheRef.current!.hasCachedAudio(
          storyId,
          currentLanguage
        );
        if (isCached) return;

        // Fetch and cache audio blobs
        const chaptersToCache = await Promise.all(
          audioData.chapters.map(async (chapter) => {
            try {
              const response = await fetch(chapter.audioUrl);
              const blob = await response.blob();
              return {
                chapterIndex: chapter.chapterIndex,
                audioBlob: blob,
                duration: chapter.duration,
              };
            } catch (error) {
              console.error(
                `[MULTI_LANG_AUDIO] Error fetching chapter ${chapter.chapterIndex}:`,
                error
              );
              return null;
            }
          })
        );

        const validChapters = chaptersToCache.filter(
          (ch): ch is NonNullable<typeof ch> => ch !== null
        );

        if (validChapters.length > 0) {
          await cacheRef.current!.cacheChapters(
            storyId,
            currentLanguage,
            validChapters
          );
          setCachedLanguages((prev) =>
            prev.includes(currentLanguage) ? prev : [...prev, currentLanguage]
          );
        }
      } catch (error) {
        console.error("[MULTI_LANG_AUDIO] Error caching chapters:", error);
      }
    };

    cacheChapters();
  }, [audioData, storyId, currentLanguage, enableCaching]);

  // Generate audio mutation
  const generateMutation = useMutation<
    { jobId?: string; chapters?: AudioChapter[] },
    Error,
    { language: string; config?: Omit<AudioGenerationConfig, "language"> }
  >({
    mutationFn: async ({ language, config }) => {
      const res = await fetch(`/api/stories/${storyId}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          async: true,
          ...config,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate audio");
      }

      return res.json();
    },
    onMutate: ({ language }) => {
      setGeneratingLanguages((prev) => new Set(prev).add(language));
    },
    onSuccess: (data, { language }) => {
      if (data.jobId) {
        toast.success(`Audio generation started for ${getLanguageName(language)}`);
        // Start polling for job status
        pollJobStatus(data.jobId, language);
      } else if (data.chapters) {
        setGeneratingLanguages((prev) => {
          const next = new Set(prev);
          next.delete(language);
          return next;
        });
        queryClient.invalidateQueries({
          queryKey: ["audioChapters", storyId],
        });
        toast.success(`Audio generated for ${getLanguageName(language)}`);
      }
    },
    onError: (error, { language }) => {
      setGeneratingLanguages((prev) => {
        const next = new Set(prev);
        next.delete(language);
        return next;
      });
      toast.error(`Failed to generate audio for ${getLanguageName(language)}: ${error.message}`);
    },
  });

  // Poll for job status
  const pollJobStatus = useCallback(
    async (jobId: string, language: string) => {
      const maxAttempts = 60; // 3 minutes max
      let attempts = 0;

      const poll = async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}/status`);
          if (!res.ok) return;

          const job = await res.json();

          if (job.status === "completed") {
            setGeneratingLanguages((prev) => {
              const next = new Set(prev);
              next.delete(language);
              return next;
            });
            queryClient.invalidateQueries({
              queryKey: ["audioChapters", storyId],
            });
            toast.success(`Audio ready for ${getLanguageName(language)}!`);
            return;
          }

          if (job.status === "failed") {
            setGeneratingLanguages((prev) => {
              const next = new Set(prev);
              next.delete(language);
              return next;
            });
            toast.error(`Audio generation failed for ${getLanguageName(language)}`);
            return;
          }

          // Continue polling
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 3000);
          } else {
            setGeneratingLanguages((prev) => {
              const next = new Set(prev);
              next.delete(language);
              return next;
            });
            toast.error("Audio generation timed out. Please try again.");
          }
        } catch (error) {
          console.error("[MULTI_LANG_AUDIO] Error polling job status:", error);
        }
      };

      poll();
    },
    [storyId, queryClient]
  );

  // Get language name helper
  const getLanguageName = useCallback(
    (code: string): string => {
      const lang = audioData?.supportedLanguages?.find((l) => l.code === code);
      return lang?.nativeName || lang?.name || code;
    },
    [audioData?.supportedLanguages]
  );

  // Change language with cache check
  const changeLanguage = useCallback(
    async (language: string) => {
      setCurrentLanguage(language);

      // Check if we have cached audio for this language
      if (enableCaching && cacheRef.current) {
        setIsLoadingFromCache(true);
        try {
          const hasCached = await cacheRef.current.hasCachedAudio(storyId, language);
          if (hasCached) {
            console.log(`[MULTI_LANG_AUDIO] Using cached audio for ${language}`);
          }
        } catch (error) {
          console.error("[MULTI_LANG_AUDIO] Error checking cache:", error);
        } finally {
          setIsLoadingFromCache(false);
        }
      }
    },
    [storyId, enableCaching]
  );

  // Generate audio for a specific language
  const generateAudioForLanguage = useCallback(
    (language: string, config?: Omit<AudioGenerationConfig, "language">) => {
      generateMutation.mutate({ language, config });
    },
    [generateMutation]
  );

  // Generate audio for current language
  const generateAudio = useCallback(
    (config?: Omit<AudioGenerationConfig, "language">) => {
      generateAudioForLanguage(currentLanguage, config);
    },
    [currentLanguage, generateAudioForLanguage]
  );

  // Get cached chapter blob URL
  const getCachedChapterUrl = useCallback(
    async (chapterIndex: number): Promise<string | null> => {
      if (!enableCaching || !cacheRef.current) return null;

      try {
        const cached = await cacheRef.current.getCachedChapter(
          storyId,
          chapterIndex,
          currentLanguage
        );
        if (cached) {
          return URL.createObjectURL(cached.audioBlob);
        }
      } catch (error) {
        console.error("[MULTI_LANG_AUDIO] Error getting cached chapter:", error);
      }
      return null;
    },
    [storyId, currentLanguage, enableCaching]
  );

  // Clear cache for a language
  const clearLanguageCache = useCallback(
    async (language?: string) => {
      if (!enableCaching || !cacheRef.current) return;

      try {
        await cacheRef.current.clearCache(storyId, language);
        if (language) {
          setCachedLanguages((prev) => prev.filter((l) => l !== language));
        } else {
          setCachedLanguages([]);
        }
        toast.success(
          language
            ? `Cache cleared for ${getLanguageName(language)}`
            : "All audio cache cleared"
        );
      } catch (error) {
        console.error("[MULTI_LANG_AUDIO] Error clearing cache:", error);
        toast.error("Failed to clear cache");
      }
    },
    [storyId, enableCaching, getLanguageName]
  );

  // Get language audio status
  const getLanguageStatus = useCallback(
    (language: string): LanguageAudioStatus => {
      const hasServerAudio = audioData?.availableLanguages?.includes(language) ?? false;
      const hasCachedAudio = cachedLanguages.includes(language);
      const isGenerating = generatingLanguages.has(language);

      return {
        language,
        hasServerAudio,
        hasCachedAudio,
        isGenerating,
      };
    },
    [audioData?.availableLanguages, cachedLanguages, generatingLanguages]
  );

  // Get all languages with their status
  const getAllLanguageStatuses = useCallback((): LanguageAudioStatus[] => {
    const supportedLanguages = audioData?.supportedLanguages ?? [];
    return supportedLanguages.map((lang) => getLanguageStatus(lang.code));
  }, [audioData?.supportedLanguages, getLanguageStatus]);

  // Check if audio exists for current language
  const hasAudio = (audioData?.chapters?.length ?? 0) > 0;
  const hasAudioForLanguage = useCallback(
    (language: string): boolean => {
      return (
        audioData?.availableLanguages?.includes(language) ||
        cachedLanguages.includes(language)
      );
    },
    [audioData?.availableLanguages, cachedLanguages]
  );

  // Get available languages that have audio (server or cached)
  const availableLanguages: SupportedLanguage[] = (
    audioData?.supportedLanguages ?? []
  ).filter(
    (lang) =>
      audioData?.availableLanguages?.includes(lang.code) ||
      cachedLanguages.includes(lang.code)
  );

  return {
    // Data
    chapters: audioData?.chapters ?? [],
    totalChapters: audioData?.totalChapters ?? 0,
    totalDuration: audioData?.totalDuration ?? 0,
    currentLanguage,
    availableLanguages,
    supportedLanguages: audioData?.supportedLanguages ?? [],
    cachedLanguages,
    hasAudio,

    // Loading states
    isLoading: isLoadingServer || isLoadingFromCache,
    isGenerating: generatingLanguages.size > 0,
    isGeneratingLanguage: (lang: string) => generatingLanguages.has(lang),
    generatingLanguages: Array.from(generatingLanguages),

    // Error
    error: error as Error | null,

    // Actions
    changeLanguage,
    generateAudio,
    generateAudioForLanguage,
    getCachedChapterUrl,
    clearLanguageCache,
    refetch,

    // Status helpers
    getLanguageStatus,
    getAllLanguageStatuses,
    hasAudioForLanguage,
    getLanguageName,
  };
}

export default useMultiLanguageAudio;
