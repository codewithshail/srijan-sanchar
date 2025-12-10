"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Clock, Sparkles, RefreshCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GenerationProgressProps {
  storyId: string;
  jobId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface JobStatus {
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  progressMessage?: string;
  progressStage?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  result?: {
    generatedStory?: boolean;
    wordCount?: number;
    pages?: number;
    duration?: number;
    imageGenerationQueued?: boolean;
  };
  error?: string;
}

const STATUS_MESSAGES: Record<string, string> = {
  pending: "Waiting in queue...",
  processing: "Generating your story...",
  completed: "Story generated successfully!",
  failed: "Generation failed",
};

// Fallback progress steps if server doesn't provide messages
const PROGRESS_STEPS = [
  { progress: 10, message: "Analyzing your life stages..." },
  { progress: 30, message: "Creating narrative structure..." },
  { progress: 60, message: "Writing your story..." },
  { progress: 80, message: "Polishing and formatting..." },
  { progress: 90, message: "Finalizing..." },
  { progress: 100, message: "Complete!" },
];

export function GenerationProgress({
  storyId,
  jobId,
  onComplete,
  onError,
}: GenerationProgressProps) {
  const [currentMessage, setCurrentMessage] = useState("Starting generation...");
  const [isRetrying, setIsRetrying] = useState(false);

  const { data: jobStatus, error, refetch } = useQuery<JobStatus>({
    queryKey: ["jobStatus", storyId, jobId],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/status`);
      if (!res.ok) throw new Error("Failed to fetch job status");
      return res.json();
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling when job is complete or failed
      if (status === "completed" || status === "failed") {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    enabled: !!jobId,
  });

  // Update message based on progress - prefer server message
  useEffect(() => {
    if (jobStatus?.progressMessage) {
      setCurrentMessage(jobStatus.progressMessage);
    } else if (jobStatus?.progress) {
      const step = PROGRESS_STEPS.find((s) => s.progress >= (jobStatus.progress || 0));
      if (step) {
        setCurrentMessage(step.message);
      }
    }
  }, [jobStatus?.progress, jobStatus?.progressMessage]);

  // Handle completion
  useEffect(() => {
    if (jobStatus?.status === "completed") {
      onComplete?.();
    } else if (jobStatus?.status === "failed") {
      onError?.(jobStatus.error || "Unknown error");
    }
  }, [jobStatus?.status, jobStatus?.error, onComplete, onError]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      if (res.ok) {
        // Refetch status after retry
        await refetch();
      }
    } catch (err) {
      console.error('Failed to retry job:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const progress = jobStatus?.progress || 0;
  const status = jobStatus?.status || "pending";
  const attemptsMade = jobStatus?.attemptsMade || 0;
  const maxAttempts = jobStatus?.maxAttempts || 3;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-2">
        <CardTitle className="flex items-center justify-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Story Generation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Icon */}
        <div className="flex justify-center">
          {status === "pending" && (
            <div className="p-4 rounded-full bg-muted">
              <Clock className="h-8 w-8 text-muted-foreground animate-pulse" />
            </div>
          )}
          {status === "processing" && (
            <div className="p-4 rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          )}
          {status === "completed" && (
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          )}
          {status === "failed" && (
            <div className="p-4 rounded-full bg-destructive/10">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{currentMessage}</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* Status Message */}
        <p
          className={cn(
            "text-center text-sm",
            status === "completed" && "text-green-600 dark:text-green-400",
            status === "failed" && "text-destructive"
          )}
        >
          {STATUS_MESSAGES[status]}
        </p>

        {/* Error Message */}
        {status === "failed" && jobStatus?.error && (
          <div className="space-y-2">
            <p className="text-center text-xs text-muted-foreground bg-destructive/10 p-2 rounded">
              {jobStatus.error}
            </p>
            {attemptsMade > 0 && (
              <p className="text-center text-xs text-muted-foreground">
                Attempted {attemptsMade} of {maxAttempts} times
              </p>
            )}
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Result Info */}
        {status === "completed" && jobStatus?.result && (
          <div className="text-center text-sm text-muted-foreground space-y-1">
            {jobStatus.result.wordCount && (
              <p>{jobStatus.result.wordCount.toLocaleString()} words</p>
            )}
            {jobStatus.result.pages && <p>{jobStatus.result.pages} pages</p>}
            {jobStatus.result.duration && (
              <p className="text-xs">
                Generated in {Math.round(jobStatus.result.duration / 1000)}s
              </p>
            )}
            {jobStatus.result.imageGenerationQueued && (
              <p className="text-xs text-primary">
                Images are being generated...
              </p>
            )}
          </div>
        )}

        {/* Retry info during processing */}
        {status === "processing" && attemptsMade > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            Attempt {attemptsMade + 1} of {maxAttempts}
          </p>
        )}

        {/* Error state shows retry hint */}
        {error && (
          <p className="text-center text-xs text-destructive">
            Failed to check status. Please refresh the page.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
