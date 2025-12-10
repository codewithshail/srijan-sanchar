"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { EnhancedStoryViewer } from "@/components/enhanced-story-viewer";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import * as React from "react";

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
  content: string | null;
  storyType: "life_story" | "blog_story";
  image: StoryImage | null;
  summary: StorySummary | null;
  status: "draft" | "completed" | "pending_review" | "published" | "rejected";
  visibility: "private" | "public_summary" | "public_long";
  bannerImageUrl: string | null;
  thumbnailImageUrl: string | null;
  publishedAt: string | null;
  viewCount: number;
  listenCount: number;
  shareCount: number;
  owner: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export default function StoryPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { userId } = useAuth();
  const [pollCount, setPollCount] = useState(0);

  const {
    data: story,
    isLoading,
    error,
    refetch,
  } = useQuery<StoryData>({
    queryKey: ["story", storyId],
    queryFn: async (): Promise<StoryData> => {
      const res = await fetch(`/api/stories/${storyId}`, { cache: "no-store" });
      if (!res.ok) {
        if (res.status === 404) throw new Error("Story not found");
        throw new Error("Failed to fetch story");
      }
      return res.json();
    },
    retry: 1,
    refetchInterval: (query) => {
      const s = query.state.data as StoryData | undefined;
      const shouldPoll =
        s?.status === "draft" && !s?.summary?.userSummary && pollCount < 20;
      return shouldPoll ? 3000 : false;
    },
    refetchIntervalInBackground: false,
  });

  // Handle poll count increment when data changes
  React.useEffect(() => {
    if (
      story?.status === "draft" &&
      !story?.summary?.userSummary &&
      pollCount < 20
    ) {
      setPollCount((c) => c + 1);
    }
  }, [story, pollCount]);

  if (isLoading)
    return (
      <div className="container py-8 text-center">Loading your story...</div>
    );
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

  const hasAnySummary = Boolean(
    story.summary?.userSummary || story.summary?.longFormStory || story.content
  );
  const isOwner = userId === story.owner.clerkId;

  if (story.status === "draft" && !hasAnySummary) {
    return (
      <div className="container py-12 text-center flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <h1 className="text-2xl font-bold">Your story is being woven...</h1>
        <p className="text-muted-foreground max-w-md">
          This can take a minute. We're generating your narrative and insights.
          Please stay on this page.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Refresh now
          </Button>
          <Button
            variant="secondary"
            onClick={() => (window.location.href = `/editor/${storyId}`)}
          >
            Open Editor
          </Button>
        </div>
        {pollCount >= 20 && (
          <p className="text-xs text-muted-foreground">
            Still processing… You can continue editing while we finish up.
          </p>
        )}
      </div>
    );
  }

  return <EnhancedStoryViewer story={story} isOwner={isOwner} />;
}
