"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, LoadingButton } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { GenerationProgress } from "@/components/life-story/generation-progress";
import {
  Image as ImageIcon,
  FileText,
  Sparkles,
  Users,
  Palette,
  Clock,
  BookOpen,
} from "lucide-react";

/**
 * Configuration options for story generation
 */
export interface GenerationConfig {
  includeAIImages: boolean;
  numberOfPages: number;
  improveGrammar: boolean;
  tone: "formal" | "casual" | "poetic" | "narrative";
  targetAudience: "children" | "adults" | "all";
  imageStyle: "realistic" | "artistic" | "minimalist";
}

interface StoryGenerationConfigDialogProps {
  storyId: string;
  storyType: "life_story" | "blog_story";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback when generation completes successfully */
  onComplete?: () => void;
  /** Optional callback when generation fails */
  onError?: (error: string) => void;
  /** Custom API endpoint for submission (defaults to /api/stories/[storyId]/submit) */
  submitEndpoint?: string;
}

const PAGE_OPTIONS = [4, 8, 12, 16, 20, 24];

const TONE_OPTIONS = [
  { value: "narrative", label: "Narrative", description: "Storytelling style" },
  { value: "formal", label: "Formal", description: "Professional tone" },
  { value: "casual", label: "Casual", description: "Conversational" },
  { value: "poetic", label: "Poetic", description: "Lyrical and expressive" },
] as const;

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Ages", description: "Suitable for everyone" },
  { value: "adults", label: "Adults", description: "Mature content" },
  { value: "children", label: "Children", description: "Kid-friendly" },
] as const;

const IMAGE_STYLE_OPTIONS = [
  { value: "artistic", label: "Artistic", description: "Creative and stylized" },
  { value: "realistic", label: "Realistic", description: "Photo-like quality" },
  { value: "minimalist", label: "Minimalist", description: "Simple and clean" },
] as const;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: GenerationConfig = {
  includeAIImages: false,
  numberOfPages: 12,
  improveGrammar: true,
  tone: "narrative",
  targetAudience: "adults",
  imageStyle: "artistic",
};


/**
 * Calculate estimated generation time based on configuration
 * @param config - The generation configuration
 * @returns Estimated time in minutes
 */
function calculateEstimatedTime(config: GenerationConfig): number {
  // Base time per page (in seconds)
  const baseTimePerPage = 30;
  
  // Additional time for AI images (in seconds)
  const imageGenerationTime = config.includeAIImages ? 45 : 0;
  
  // Additional time for grammar improvement (in seconds)
  const grammarTime = config.improveGrammar ? 15 : 0;
  
  // Calculate total time in seconds
  const totalSeconds = 
    (config.numberOfPages * baseTimePerPage) + 
    (config.includeAIImages ? config.numberOfPages * imageGenerationTime : 0) + 
    grammarTime;
  
  // Convert to minutes and round up
  return Math.max(1, Math.ceil(totalSeconds / 60));
}

/**
 * Story Generation Configuration Dialog Component
 * 
 * A reusable dialog for configuring story generation options including:
 * - AI image generation toggle
 * - Page count selection
 * - Grammar improvement toggle
 * - Tone selection
 * - Target audience selection
 * - Image style selection (when AI images enabled)
 * - Estimated generation time display
 * 
 * @example
 * ```tsx
 * <StoryGenerationConfigDialog
 *   storyId="123"
 *   storyType="life_story"
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onComplete={() => router.push(`/story/${storyId}`)}
 * />
 * ```
 */
export function StoryGenerationConfigDialog({
  storyId,
  storyType,
  open,
  onOpenChange,
  onComplete,
  onError,
  submitEndpoint,
}: StoryGenerationConfigDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"config" | "progress">("config");
  const [jobId, setJobId] = useState<string | null>(null);
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);

  // Calculate estimated time based on current config
  const estimatedTime = useMemo(() => calculateEstimatedTime(config), [config]);

  // Determine the API endpoint
  const endpoint = submitEndpoint || `/api/stories/${storyId}/submit`;

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (submissionConfig: GenerationConfig) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...submissionConfig,
          storyType,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit story for generation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep("progress");
      toast.success("Story submitted for generation!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
      onError?.(error.message);
    },
  });

  const handleSubmit = useCallback(() => {
    submitMutation.mutate(config);
  }, [config, submitMutation]);

  const handleComplete = useCallback(() => {
    toast.success("Your story has been generated!");
    onOpenChange(false);
    if (onComplete) {
      onComplete();
    } else {
      router.push(`/story/${storyId}`);
    }
  }, [onOpenChange, onComplete, router, storyId]);

  const handleError = useCallback((error: string) => {
    toast.error(`Generation failed: ${error}`);
    setStep("config");
    setJobId(null);
    onError?.(error);
  }, [onError]);

  const handleClose = useCallback(() => {
    if (step === "progress") {
      // Don't close during generation, redirect to dashboard
      router.push("/dashboard");
    }
    onOpenChange(false);
  }, [step, router, onOpenChange]);

  // Reset state when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setStep("config");
      setJobId(null);
      setConfig(DEFAULT_CONFIG);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Update config helper
  const updateConfig = useCallback(<K extends keyof GenerationConfig>(
    key: K,
    value: GenerationConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const dialogTitle = storyType === "life_story" 
    ? "Generate Your Life Story" 
    : "Generate Your Story";

  const dialogDescription = storyType === "life_story"
    ? "Configure how your life story will be generated"
    : "Configure how your story will be generated";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {step === "config" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {dialogTitle}
              </DialogTitle>
              <DialogDescription>
                {dialogDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Page Count */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Number of Pages
                  </Label>
                  <Badge variant="secondary">{config.numberOfPages} pages</Badge>
                </div>
                <Slider
                  value={[config.numberOfPages]}
                  onValueChange={([value]) => updateConfig("numberOfPages", value)}
                  min={4}
                  max={24}
                  step={4}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  {PAGE_OPTIONS.map((p) => (
                    <span key={p}>{p}</span>
                  ))}
                </div>
              </div>

              {/* Tone Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Story Tone
                </Label>
                <Select
                  value={config.tone}
                  onValueChange={(value: GenerationConfig["tone"]) =>
                    updateConfig("tone", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Audience */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Target Audience
                </Label>
                <Select
                  value={config.targetAudience}
                  onValueChange={(value: GenerationConfig["targetAudience"]) =>
                    updateConfig("targetAudience", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Grammar Improvement */}
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="improve-grammar"
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  Improve Grammar
                </Label>
                <Switch
                  id="improve-grammar"
                  checked={config.improveGrammar}
                  onCheckedChange={(checked) =>
                    updateConfig("improveGrammar", checked)
                  }
                />
              </div>

              {/* AI Images */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="include-images"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Include AI Images
                  </Label>
                  <Switch
                    id="include-images"
                    checked={config.includeAIImages}
                    onCheckedChange={(checked) =>
                      updateConfig("includeAIImages", checked)
                    }
                  />
                </div>

                {config.includeAIImages && (
                  <div className="pl-6 space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Palette className="h-3 w-3" />
                      Image Style
                    </Label>
                    <Select
                      value={config.imageStyle}
                      onValueChange={(value: GenerationConfig["imageStyle"]) =>
                        updateConfig("imageStyle", value)
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_STYLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Estimated Time */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                <Clock className="h-4 w-4" />
                <span>
                  Estimated generation time: ~{estimatedTime} minute
                  {estimatedTime !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <LoadingButton
                onClick={handleSubmit}
                loading={submitMutation.isPending}
              >
                Generate Story
              </LoadingButton>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Generating Your Story</DialogTitle>
              <DialogDescription>
                Please wait while we create your personalized story
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              {jobId && (
                <GenerationProgress
                  storyId={storyId}
                  jobId={jobId}
                  onComplete={handleComplete}
                  onError={handleError}
                />
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Continue in Background
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default StoryGenerationConfigDialog;
