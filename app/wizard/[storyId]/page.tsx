"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

const STAGES = [
  "Early Childhood (Ages 0-6)",
  "School Years (Ages 7-12)",
  "Adolescence (Ages 13-19)",
  "Young Adulthood (Ages 20-30)",
  "Career & Family (Ages 31-50)",
  "Midlife Transition (Ages 51-65)",
  "Later Life & Legacy (Ages 65+)",
];

type StageData = {
  currentStageIndex: number;
  selection: string | null;
  options: string[];
  isCompleted: boolean;
};

type GenerationConfig = {
  generateImage: boolean;
  storyType: "summary" | "full";
  pageCount: number;
};

export default function WizardPage({
  params,
}: {
  params: { storyId: string };
}) {
  const router = useRouter();
  const storyId = params.storyId;
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>({
    generateImage: false,
    storyType: "summary",
    pageCount: 1,
  });

  const { transcript, listening, browserSupportsSpeechRecognition } =
    useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setManualInput(transcript);
    }
  }, [transcript]);

  const {
    data: stageData,
    isLoading: isLoadingStage,
    refetch,
  } = useQuery<StageData>({
    queryKey: ["wizardStage", storyId],
    queryFn: async () => {
      const res = await fetch(`/api/wizard/${storyId}`);
      if (!res.ok) throw new Error("Failed to fetch stage data");
      const data = await res.json();
      if (data.isCompleted) {
        router.push(`/story/${storyId}`);
        return data;
      }
      const isPredefinedOption = data.options?.includes(data.selection);
      setSelectedOption(data.selection);
      setIsManualMode(!isPredefinedOption && !!data.selection);
      if (!isPredefinedOption && data.selection) {
        setManualInput(data.selection);
      }
      return data;
    },
    refetchOnWindowFocus: false,
  });

  const { mutate: regenerateOptions, isPending: isRegenerating } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/wizard/${storyId}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to regenerate options");
      return res.json();
    },
    onSuccess: () => {
      toast.success("New options generated!");
      refetch();
    },
    onError: () =>
      toast.error("Could not generate new options. Please try again."),
  });

  const { mutate: saveAndNext, isPending: isSaving } = useMutation({
    mutationFn: async (selection: string) => {
      const res = await fetch(`/api/wizard/${storyId}/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection, config }),
      });
      if (!res.ok) throw new Error("Failed to save progress");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.isCompleted) {
        toast.success("Story submitted! Generating your narrative...");
        router.push(`/story/${storyId}`);
      } else {
        setManualInput("");
        setIsManualMode(false);
        refetch();
      }
    },
    onError: () => toast.error("Failed to save. Please try again."),
  });

  const handleNext = () => {
    const finalSelection = isManualMode ? manualInput : selectedOption;
    if (finalSelection) {
      saveAndNext(finalSelection);
    }
  };

  const handleRadioChange = (value: string) => {
    setIsManualMode(false);
    setSelectedOption(value);
  };

  const handleManualMode = () => {
    setIsManualMode(true);
    setSelectedOption(null);
  };

  const stageIndex = stageData?.currentStageIndex ?? 0;
  const isCompleted = stageData?.isCompleted ?? false;
  const isFinalStage = stageIndex === 6;

  if (isLoadingStage || isCompleted) {
    return <WizardSkeleton />;
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl">
            {STAGES[stageIndex]}
          </CardTitle>
          <CardDescription>
            Select an option, or write your own to describe this time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={isManualMode ? "manual" : selectedOption ?? ""}
            onValueChange={handleRadioChange}
          >
            {(stageData?.options ?? []).map((opt, i) => (
              <Label
                key={i}
                htmlFor={`opt-${i}`}
                className="flex items-start space-x-3 rounded-md border p-4 transition-colors hover:bg-accent has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id={`opt-${i}`} value={opt} className="mt-1" />
                <span className="font-normal">{opt}</span>
              </Label>
            ))}
            <Label
              htmlFor="manual-opt"
              className="flex items-start space-x-3 rounded-md border p-4 transition-colors hover:bg-accent has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:border-primary"
            >
              <RadioGroupItem
                id="manual-opt"
                value="manual"
                className="mt-1"
                onClick={handleManualMode}
              />
              <span className="font-normal">Write my own...</span>
            </Label>
          </RadioGroup>

          {isManualMode && (
            <div className="relative">
              <Textarea
                placeholder="Describe your experience during this stage..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="pr-10"
              />
              {browserSupportsSpeechRecognition && (
                <Button
                  size="icon"
                  variant={listening ? "destructive" : "ghost"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() =>
                    listening
                      ? SpeechRecognition.stopListening()
                      : SpeechRecognition.startListening()
                  }
                >
                  <Mic className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {isFinalStage && (
            <div className="space-y-6 pt-6 border-t">
              <h3 className="text-lg font-semibold">Final Touches</h3>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="story-type">Story Format</Label>
                <RadioGroup
                  value={config.storyType}
                  onValueChange={(v: "summary" | "full") =>
                    setConfig((c) => ({ ...c, storyType: v }))
                  }
                  className="flex"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="summary" id="summary" />
                    <Label htmlFor="summary">Summary</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="full" />
                    <Label htmlFor="full">Full Story</Label>
                  </div>
                </RadioGroup>
              </div>
              {config.storyType === "full" && (
                <div className="rounded-lg border p-3">
                  <Label>Story Length (approx pages)</Label>
                  <div className="flex items-center gap-4 pt-2">
                    <Slider
                      defaultValue={[1]}
                      min={1}
                      max={5}
                      step={1}
                      onValueChange={([v]) =>
                        setConfig((c) => ({ ...c, pageCount: v }))
                      }
                    />
                    <span className="font-bold text-primary w-4">
                      {config.pageCount}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="gen-image">
                  Generate an AI image for your story?
                </Label>
                <Switch
                  id="gen-image"
                  checked={config.generateImage}
                  onCheckedChange={(v) =>
                    setConfig((c) => ({ ...c, generateImage: v }))
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Step {stageIndex + 1} of 7
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => regenerateOptions()}
              disabled={isRegenerating || isSaving}
            >
              {isRegenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              New Options
            </Button>
            <Button
              onClick={handleNext}
              disabled={(!selectedOption && !manualInput) || isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isFinalStage ? "Finish & Generate Story" : "Save & Next"}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// ... WizardSkeleton remains the same ...
function WizardSkeleton() {
  return (
    <div className="container max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <Skeleton className="h-4 w-16" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
