"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function WizardPage({ params }: { params: { storyId: string } }) {
	const router = useRouter();
	const storyId = params.storyId;
	const [selectedOption, setSelectedOption] = useState<string | null>(null);

	const { data: stageData, isLoading: isLoadingStage, refetch } = useQuery<StageData>({
		queryKey: ["wizardStage", storyId],
		queryFn: async () => {
			const res = await fetch(`/api/wizard/${storyId}`);
			if (!res.ok) throw new Error("Failed to fetch stage data");
			const data = await res.json();
			if (data.isCompleted) {
				router.push(`/story/${storyId}`);
				return data;
			}
			setSelectedOption(data.selection);
			return data;
		},
		refetchOnWindowFocus: false,
	});

	const { mutate: regenerateOptions, isPending: isRegenerating } = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/wizard/${storyId}/regenerate`, { method: "POST" });
			if (!res.ok) throw new Error("Failed to regenerate options");
			return res.json();
		},
		onSuccess: () => {
			toast.success("New options generated!");
			refetch();
		},
		onError: () => toast.error("Could not generate new options. Please try again."),
	});

	const { mutate: saveAndNext, isPending: isSaving } = useMutation({
		mutationFn: async (selection: string) => {
			const res = await fetch(`/api/wizard/${storyId}/next`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ selection }),
			});
			if (!res.ok) throw new Error("Failed to save progress");
			return res.json();
		},
		onSuccess: (data) => {
			if (data.isCompleted) {
				toast.success("Story completed! Generating your summary...");
				router.push(`/story/${storyId}`);
			} else {
				refetch();
			}
		},
		onError: () => toast.error("Failed to save. Please try again."),
	});

	const handleNext = () => {
		if (selectedOption) {
			saveAndNext(selectedOption);
		}
	};
    
	const stageIndex = stageData?.currentStageIndex ?? 0;
	const isCompleted = stageData?.isCompleted ?? false;

	if (isLoadingStage || isCompleted) {
		return <WizardSkeleton />;
	}

	return (
		<div className="container max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
			<Card className="shadow-lg">
				<CardHeader>
					<CardTitle className="text-2xl md:text-3xl">{STAGES[stageIndex]}</CardTitle>
					<CardDescription>Select the option that best resonates with your experience during this time.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<RadioGroup value={selectedOption ?? ""} onValueChange={setSelectedOption}>
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
					</RadioGroup>
				</CardContent>
				<CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-4">
					<p className="text-sm text-muted-foreground">Step {stageIndex + 1} of 7</p>
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => regenerateOptions()} disabled={isRegenerating || isSaving}>
							{isRegenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
							New Options
						</Button>
						<Button onClick={handleNext} disabled={!selectedOption || isSaving}>
							{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{stageIndex < 6 ? "Save & Next" : "Finish & See Summary"}
						</Button>
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