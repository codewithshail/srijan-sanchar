"use client";

import { StoryAnalytics } from "@/components/story-analytics";
import { use } from "react";

interface AnalyticsPageProps {
  params: Promise<{ storyId: string }>;
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { storyId } = use(params);

  return (
    <div className="container py-8">
      <StoryAnalytics storyId={storyId} />
    </div>
  );
}