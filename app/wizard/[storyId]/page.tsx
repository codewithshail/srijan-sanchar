"use client";

import { useEffect, useState } from "react";
import { Button, LoadingButton } from "@/components/ui/button";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Mic, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import StageOptions, {
  type StageBlock,
} from "@/components/wizard/stage-options";

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
  options: string[] | null;
  isCompleted: boolean;
};

type GenerationConfig = {
  generateImage: boolean;
  storyType: "summary" | "full";
  pageCount: number;
};

export default function WizardPage() {
  const router = useRouter();
  const params = useParams();
  const storyId = params.storyId as string;
  const queryClient = useQueryClient();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>({
    generateImage: false,
    storyType: "summary",
    pageCount: 1,
  });
  const [localOptions, setLocalOptions] = useState<string[]>([]);

  const {
    transcript,
    listening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  } = useSpeechRecognition();
  const [stageData, setStageData] = useState<StageData | null>(null);
  const [isLoadingStage, setIsLoadingStage] = useState(true);

  useEffect(() => {
    if (transcript) setManualInput(transcript);
  }, [transcript]);

  useEffect(() => {
    if (stageData?.options) {
      setLocalOptions(stageData.options);
    }
  }, [stageData?.currentStageIndex, stageData?.options]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingStage(true);
      const res = await fetch(`/api/wizard/${storyId}`);
      if (!res.ok) throw new Error("Failed to fetch stage data");
      const data = await res.json();
      setStageData(data);
      setIsLoadingStage(false);
      if (data.isCompleted) {
        router.push(`/story/${storyId}`);
        return;
      }
      const isPredefined = data.options?.includes(data.selection);
      setSelectedOption(data.selection);
      setIsManualMode(!isPredefined && !!data.selection);
      if (!isPredefined && data.selection) setManualInput(data.selection);
    };

    if (storyId) {
      fetchData();
    }
  }, [storyId, router]);

  const { mutate: regenerateOptions, isPending: isRegenerating } = useMutation({
    mutationFn: async (): Promise<{ options: string[] }> => {
      const res = await fetch(`/api/wizard/${storyId}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to regenerate options");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("New options generated");
      queryClient.setQueryData(
        ["wizardStage", storyId],
        (oldData: StageData | undefined) => {
          if (!oldData) return oldData;
          return { ...oldData, options: data.options };
        }
      );
    },
    onError: (e) =>
      toast.error((e as Error).message || "Could not generate new options"),
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
        toast.success("Generating your narrative...");
        router.push(`/story/${storyId}`);
      } else {
        setManualInput("");
        setIsManualMode(false);
        resetTranscript();
        setStageData(data);
      }
    },
    onError: () => toast.error("Failed to save. Please try again."),
  });

  const handleNext = () => {
    const finalSelection = isManualMode ? manualInput.trim() : selectedOption;
    if (finalSelection) saveAndNext(finalSelection);
  };

  const handleRadioChange = (value: string) => {
    setIsManualMode(false);
    setSelectedOption(value);
  };

  const handleManualMode = () => {
    setIsManualMode(true);
    setSelectedOption(null);
  };

  const handleStageChange = (next: StageBlock) => {
    const cleanOptions = next.options.map((o) =>
      o.value.startsWith("*") ? o.value.slice(1) : o.value
    );
    setLocalOptions(cleanOptions);
    const selected = next.options.find((o) => o.value.startsWith("*"));
    setSelectedOption(
      selected
        ? selected.value.startsWith("*")
          ? selected.value.slice(1)
          : selected.value
        : null
    );
    setIsManualMode(false);
  };

  const stageIndex = stageData?.currentStageIndex ?? 0;
  const isFinalStage = stageIndex === 6;

  if (isLoadingStage || !stageData) return <WizardSkeleton />;

  const stageBlock: StageBlock = {
    range: STAGES[stageIndex],
    options: (localOptions ?? []).map((opt) => ({
      label: opt,
      value: selectedOption === opt ? `*${opt}` : opt,
    })),
  };

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
          <StageOptions
            stage={stageBlock}
            onChange={handleStageChange}
            singleSelect
          />

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Didn&apos;t see your option?
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleManualMode}
            >
              Write my own...
            </Button>
          </div>

          {isManualMode && (
            <div className="relative">
              <Textarea
                placeholder="Describe your experience during this stage..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="pr-10 min-h-[100px]"
              />
              {browserSupportsSpeechRecognition && (
                <Button
                  size="icon"
                  variant={listening ? "destructive" : "ghost"}
                  className="absolute right-2 top-2 h-7 w-7"
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
              <h3 className="text-lg font-semibold">
                Final Touches & Generation Options
              </h3>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="story-type" className="flex flex-col space-y-1">
                  <span>Story Format</span>
                  <span className="font-normal leading-snug text-muted-foreground text-sm">
                    Choose a brief summary or a detailed story.
                  </span>
                </Label>
                <RadioGroup
                  value={config.storyType}
                  onValueChange={(v: "summary" | "full") =>
                    setConfig((c) => ({ ...c, storyType: v }))
                  }
                  className="flex gap-4"
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
                  <Label>Story Length (approx. pages)</Label>
                  <div className="flex items-center gap-4 pt-2">
                    <Slider
                      defaultValue={[1]}
                      min={1}
                      max={5}
                      step={1}
                      onValueChange={([v]: number[]) =>
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
                <Label htmlFor="gen-image" className="flex flex-col space-y-1">
                  <span>Generate AI Image</span>
                  <span className="font-normal leading-snug text-muted-foreground text-sm">
                    Create a unique image for your story.
                  </span>
                </Label>
                <Switch
                  id="gen-image"
                  checked={config.generateImage}
                  onCheckedChange={(v: boolean) =>
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
            <LoadingButton
              variant="outline"
              onClick={() => regenerateOptions()}
              loading={isRegenerating}
              disabled={isSaving}
              icon={<Sparkles className="h-4 w-4" />}
            >
              New Options
            </LoadingButton>
            <LoadingButton
              onClick={handleNext}
              loading={isSaving}
              disabled={!selectedOption && !manualInput.trim()}
            >
              {isFinalStage ? "Finish & Generate Story" : "Save & Next"}
            </LoadingButton>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

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
        <CardFooter className="flex justify-between items-center" />
      </Card>
    </div>
  );
}
