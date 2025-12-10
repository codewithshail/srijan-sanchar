"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GenerationProgress } from "./generation-progress";
import {
  AlertTriangle,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Users,
  Palette,
} from "lucide-react";

interface SubmissionDialogProps {
  storyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SubmissionConfig {
  includeAIImages: boolean;
  numberOfPages: number;
  improveGrammar: boolean;
  tone: "formal" | "casual" | "poetic" | "narrative";
  targetAudience: "children" | "adults" | "all";
  imageStyle: "realistic" | "artistic" | "minimalist";
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stagesWithContent: number;
  totalStages: number;
  totalContentLength: number;
}

interface SubmissionStatus {
  storyId: string;
  validation: ValidationResult;
  latestJob: {
    id: string;
    status: string;
    error?: string;
  } | null;
  canSubmit: boolean;
}

const PAGE_OPTIONS = [4, 8, 12, 16, 20, 24];

const TONE_OPTIONS = [
  { value: "narrative", label: "Narrative", description: "Storytelling style" },
  { value: "formal", label: "Formal", description: "Professional tone" },
  { value: "casual", label: "Casual", description: "Conversational" },
  { value: "poetic", label: "Poetic", description: "Lyrical and expressive" },
];

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Ages" },
  { value: "adults", label: "Adults" },
  { value: "children", label: "Children" },
];

const IMAGE_STYLE_OPTIONS = [
  { value: "artistic", label: "Artistic" },
  { value: "realistic", label: "Realistic" },
  { value: "minimalist", label: "Minimalist" },
];

export function SubmissionDialog({
  storyId,
  open,
  onOpenChange,
}: SubmissionDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<"config" | "progress">("config");
  const [jobId, setJobId] = useState<string | null>(null);
  const [config, setConfig] = useState<SubmissionConfig>({
    includeAIImages: false,
    numberOfPages: 12,
    improveGrammar: true,
    tone: "narrative",
    targetAudience: "adults",
    imageStyle: "artistic",
  });

  // Fetch submission status and validation
  const { data: submissionStatus, isLoading: isLoadingStatus } =
    useQuery<SubmissionStatus>({
      queryKey: ["submissionStatus", storyId],
      queryFn: async () => {
        const res = await fetch(`/api/stories/${storyId}/submit`);
        if (!res.ok) throw new Error("Failed to fetch submission status");
        return res.json();
      },
      enabled: open,
    });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (submissionConfig: SubmissionConfig) => {
      const res = await fetch(`/api/stories/${storyId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionConfig),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit story");
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
    },
  });

  const handleSubmit = useCallback(() => {
    submitMutation.mutate(config);
  }, [config, submitMutation]);

  const handleComplete = useCallback(() => {
    toast.success("Your story has been generated!");
    onOpenChange(false);
    router.push(`/story/${storyId}`);
  }, [onOpenChange, router, storyId]);

  const handleError = useCallback((error: string) => {
    toast.error(`Generation failed: ${error}`);
    setStep("config");
    setJobId(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === "progress") {
      // Don't close during generation, redirect to dashboard
      router.push("/dashboard");
    }
    onOpenChange(false);
  }, [step, router, onOpenChange]);

  const validation = submissionStatus?.validation;
  const canSubmit = submissionStatus?.canSubmit && !submitMutation.isPending;

  // Estimate generation time based on config
  const estimatedTime = Math.ceil(
    (config.numberOfPages * 0.5 + (config.includeAIImages ? 30 : 0) + (config.improveGrammar ? 10 : 0)) / 60
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        {step === "config" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Generate Your Story
              </DialogTitle>
              <DialogDescription>
                Configure how your life story will be generated
              </DialogDescription>
            </DialogHeader>

            {isLoadingStatus ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="space-y-6 py-4">
                {/* Validation Status */}
                {validation && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {validation.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="text-sm font-medium">
                        {validation.stagesWithContent} of {validation.totalStages}{" "}
                        stages completed
                      </span>
                    </div>

                    {validation.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          <ul className="list-disc list-inside text-sm">
                            {validation.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {validation.warnings.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside text-sm">
                            {validation.warnings.map((warning, i) => (
                              <li key={i}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

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
                    onValueChange={([value]) =>
                      setConfig((c) => ({ ...c, numberOfPages: value }))
                    }
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
                    <Sparkles className="h-4 w-4" />
                    Story Tone
                  </Label>
                  <Select
                    value={config.tone}
                    onValueChange={(value: SubmissionConfig["tone"]) =>
                      setConfig((c) => ({ ...c, tone: value }))
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
                    onValueChange={(value: SubmissionConfig["targetAudience"]) =>
                      setConfig((c) => ({ ...c, targetAudience: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                    <CheckCircle2 className="h-4 w-4" />
                    Improve Grammar
                  </Label>
                  <Switch
                    id="improve-grammar"
                    checked={config.improveGrammar}
                    onCheckedChange={(checked) =>
                      setConfig((c) => ({ ...c, improveGrammar: checked }))
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
                        setConfig((c) => ({ ...c, includeAIImages: checked }))
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
                        onValueChange={(value: SubmissionConfig["imageStyle"]) =>
                          setConfig((c) => ({ ...c, imageStyle: value }))
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {IMAGE_STYLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Estimated Time */}
                <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                  Estimated generation time: ~{estimatedTime} minute
                  {estimatedTime !== 1 ? "s" : ""}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <LoadingButton
                onClick={handleSubmit}
                loading={submitMutation.isPending}
                disabled={!canSubmit}
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
