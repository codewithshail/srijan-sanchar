"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { CheckCircle, Loader2 } from "lucide-react";

type StoryImage = { url: string; prompt: string };
type StorySummary = {
  userSummary: string;
  psySummary: string;
  actionableSteps: (string | { [key: string]: string })[];
  longFormStory?: string;
};
type StoryData = {
  id: string;
  title: string | null;
  image: StoryImage | null;
  summary: StorySummary | null;
  owner: { firstName: string | null; lastName: string | null };
};

export default function PsychiatristStoryViewPage({
  params,
}: {
  params: { storyId: string };
}) {
  const {
    data: story,
    isLoading,
    error,
  } = useQuery<StoryData>({
    queryKey: ["psychiatrist-story", params.storyId],
    queryFn: async () => {
      const res = await fetch(`/api/psychiatrist/stories/${params.storyId}`);
      if (!res.ok) throw new Error("Failed to fetch story details");
      return res.json();
    },
    retry: 1,
  });

  if (isLoading) return <StoryViewSkeleton />;
  if (error)
    return (
      <div className="container py-8 text-center text-destructive">
        {(error as Error).message}
      </div>
    );
  if (!story)
    return (
      <div className="container py-8 text-center">No story data available.</div>
    );

  const ownerName =
    `${story.owner.firstName || ""} ${story.owner.lastName || ""}`.trim() ||
    "Anonymous User";

  return (
    <article className="max-w-4xl mx-auto py-8 sm:py-12 px-4">
      <header className="text-center mb-8 border-b pb-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {story.title ?? "A Patient's Story"}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Clinical view for patient: <strong>{ownerName}</strong>
        </p>
      </header>

      {story.image && (
        <div className="mb-8">
          <div className="aspect-video relative w-full overflow-hidden rounded-lg border shadow-lg">
            <Image
              src={story.image.url}
              alt={story.image.prompt}
              fill
              style={{ objectFit: "cover" }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2 italic text-center">
            Image prompt: &quot;{story.image.prompt}&quot;
          </p>
        </div>
      )}

      <Tabs defaultValue="psy-summary" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="psy-summary">Clinical Formulation</TabsTrigger>
          <TabsTrigger value="user-narrative">Patient's Narrative</TabsTrigger>
          <TabsTrigger value="action-plan">Actionable Steps</TabsTrigger>
        </TabsList>
        <TabsContent
          value="psy-summary"
          className="pt-6 prose dark:prose-invert max-w-none"
        >
          <h2>Psychiatrist Summary & Formulation</h2>
          <p className="whitespace-pre-wrap">{story.summary?.psySummary}</p>
        </TabsContent>
        <TabsContent
          value="user-narrative"
          className="pt-6 prose dark:prose-invert max-w-none"
        >
          <h2>Patient's Summary</h2>
          <p className="whitespace-pre-wrap">{story.summary?.userSummary}</p>
          {story.summary?.longFormStory && (
            <>
              <hr className="my-8" />
              <h2>Patient's Full Story</h2>
              <div className="whitespace-pre-wrap">
                {story.summary.longFormStory}
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="action-plan">
          <div className="bg-muted/30 p-6 rounded-lg mt-6">
            <h3 className="text-xl font-bold mb-4">
              Proposed Actionable Steps
            </h3>
            <ul className="space-y-4">
              {story.summary?.actionableSteps.map((step, i) => (
                <li key={i} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-3 flex-shrink-0" />
                  <span>
                    {typeof step === "string"
                      ? step
                      : String(Object.values(step)[0])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </article>
  );
}

function StoryViewSkeleton() {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4">
      <header className="text-center mb-8 border-b pb-6">
        <Skeleton className="h-12 w-3/4 mx-auto" />
        <Skeleton className="h-6 w-1/2 mx-auto mt-4" />
      </header>
      <Skeleton className="aspect-video w-full rounded-lg" />
      <div className="mt-8">
        <Skeleton className="h-10 w-full mb-4" />
        <div className="space-y-2 pt-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  );
}
