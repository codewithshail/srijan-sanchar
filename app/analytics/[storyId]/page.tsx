"use client";

import { StoryAnalytics } from "@/components/story-analytics";
import { use } from "react";

interface AnalyticsPageProps {
  params: Promise<{ storyId: string }>;
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { storyId } = use(params);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <StoryAnalytics storyId={storyId} />
    </div>
  );
}