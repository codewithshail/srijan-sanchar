"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
 * Audio generation response
 */
interface AudioGenerationResponse {
  message: string;
  jobId?: string;
  storyId: string;
  chapters?: AudioChapter[];
  totalChapters?: number;
  totalDuration?: number;
  language?: string;
  speaker?: string;
  config?: AudioGenerationConfig;
  failedChapters?: Array<{ index: number; error: string }>;
}

/**
 * Hook options
 */
interface UseAudioChaptersOptions {
  storyId: string;
  initialLanguage?: string;
  autoFetch?: boolean;
}

/**
 * Hook for managing audio chapters
 * 
 * Provides functionality to:
 * - Fetch existing audio chapters
 * - Generate new audio chapters
 * - Switch between languages
 * - Track generation progress
 * 
 * Requirements: 8.1, 8.4, 8.5
 */
export function useAudioChapters({
  storyId,
  initialLanguage = "en-IN",
  autoFetch = true,
}: UseAudioChaptersOptions) {
  const queryClient = useQueryClient();
  const [currentLanguage, setCurrentLanguage] = useState(initialLanguage);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);

  // Fetch audio chapters
  const {
    data: audioData,
    isLoading,
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

  // Generate audio chapters mutation
  const generateMutation = useMutation<
    AudioGenerationResponse,
    Error,
    AudioGenerationConfig
  >({
    mutationFn: async (config) => {
      const res = await fetch(`/api/stories/${storyId}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: currentLanguage,
          ...config,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate audio");
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (data.jobId) {
        // Async generation started
        setGenerationJobId(data.jobId);
        toast.success("Audio generation started. This may take a few minutes.");
      } else if (data.chapters) {
        // Sync generation completed
        queryClient.invalidateQueries({
          queryKey: ["audioChapters", storyId],
        });
        toast.success(`Generated ${data.totalChapters} audio chapters`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Delete audio chapters mutation
  const deleteMutation = useMutation<void, Error, string | undefined>({
    mutationFn: async (language) => {
      const params = new URLSearchParams();
      if (language) {
        params.set("language", language);
      }

      const res = await fetch(
        `/api/stories/${storyId}/audio?${params.toString()}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        throw new Error("Failed to delete audio chapters");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["audioChapters", storyId],
      });
      toast.success("Audio chapters deleted");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Poll for job status when generating async
  useEffect(() => {
    if (!generationJobId) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${generationJobId}/status`);
        if (!res.ok) return;

        const job = await res.json();

        if (job.status === "completed") {
          setGenerationJobId(null);
          queryClient.invalidateQueries({
            queryKey: ["audioChapters", storyId],
          });
          toast.success("Audio generation completed!");
        } else if (job.status === "failed") {
          setGenerationJobId(null);
          toast.error("Audio generation failed. Please try again.");
        }
      } catch (error) {
        console.error("Failed to poll job status:", error);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [generationJobId, storyId, queryClient]);

  // Change language
  const changeLanguage = useCallback(
    (language: string) => {
      setCurrentLanguage(language);
    },
    []
  );

  // Generate audio for current language
  const generateAudio = useCallback(
    (config?: Omit<AudioGenerationConfig, "language">) => {
      generateMutation.mutate({
        language: currentLanguage,
        ...config,
      });
    },
    [currentLanguage, generateMutation]
  );

  // Delete audio for specific or all languages
  const deleteAudio = useCallback(
    (language?: string) => {
      deleteMutation.mutate(language);
    },
    [deleteMutation]
  );

  // Check if audio exists for current language
  const hasAudio = (audioData?.chapters?.length ?? 0) > 0;

  // Get available languages that have audio
  const availableLanguages = audioData?.availableLanguages ?? [];

  // Get all supported languages
  const supportedLanguages = audioData?.supportedLanguages ?? [];

  // Get languages with audio as SupportedLanguage objects
  const languagesWithAudio: SupportedLanguage[] = supportedLanguages.filter(
    (lang) => availableLanguages.includes(lang.code)
  );

  return {
    // Data
    chapters: audioData?.chapters ?? [],
    totalChapters: audioData?.totalChapters ?? 0,
    totalDuration: audioData?.totalDuration ?? 0,
    currentLanguage,
    availableLanguages: languagesWithAudio,
    supportedLanguages,
    hasAudio,

    // Loading states
    isLoading,
    isGenerating: generateMutation.isPending || !!generationJobId,
    isDeleting: deleteMutation.isPending,
    generationJobId,

    // Error
    error: error as Error | null,

    // Actions
    changeLanguage,
    generateAudio,
    deleteAudio,
    refetch,
  };
}

export default useAudioChapters;
