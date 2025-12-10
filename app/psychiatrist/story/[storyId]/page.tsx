"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { 
  CheckCircle, 
  User, 
  Calendar, 
  Eye, 
  Headphones, 
  FileText, 
  Brain, 
  Target, 
  Clock,
  TrendingUp,
  AlertTriangle,
  BookOpen
} from "lucide-react";
import { useParams } from "next/navigation";

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
  storyType: 'life_story' | 'blog_story';
  status: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  viewCount: number;
  listenCount: number;
  image: StoryImage | null;
  summary: StorySummary | null;
  owner: { 
    firstName: string | null; 
    lastName: string | null; 
    clerkId: string;
  };
};

type StoryAnalytics = {
  totalViews: number;
  totalListens: number;
  engagementRate: number;
  lastViewedAt: string | null;
  viewsByLanguage: { [key: string]: number };
};

export default function PsychiatristStoryViewPage() {
  // Use useParams hook for client components in Next.js 15
  const params = useParams<{ storyId: string }>();
  const storyId = params.storyId;

  const {
    data: story,
    isLoading,
    error,
  } = useQuery<StoryData>({
    queryKey: ["psychiatrist-story", storyId],
    queryFn: async () => {
      const res = await fetch(`/api/psychiatrist/stories/${storyId}`);
      if (!res.ok) throw new Error("Failed to fetch story details");
      return res.json();
    },
    retry: 1,
  });

  const { data: analytics } = useQuery<StoryAnalytics>({
    queryKey: ["story-analytics", storyId],
    queryFn: async () => {
      const res = await fetch(`/api/stories/${storyId}/analytics`);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!story,
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
    <div className="max-w-6xl mx-auto py-8 sm:py-12 px-4 space-y-8">
      {/* Header Section */}
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              {story.title ?? "Untitled Story"}
            </h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{ownerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{new Date(story.createdAt).toLocaleDateString()}</span>
              </div>
              <Badge variant={story.storyType === 'life_story' ? 'default' : 'secondary'}>
                {story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
              </Badge>
              <Badge variant="outline">{story.status}</Badge>
            </div>
          </div>
        </div>

        {/* Analytics Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalViews || story.viewCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Audio Listens</CardTitle>
              <Headphones className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalListens || story.listenCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics?.engagementRate ? `${analytics.engagementRate.toFixed(1)}%` : 'N/A'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Activity</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">
                {analytics?.lastViewedAt 
                  ? new Date(analytics.lastViewedAt).toLocaleDateString()
                  : new Date(story.updatedAt).toLocaleDateString()
                }
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="clinical" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Clinical Analysis
          </TabsTrigger>
          <TabsTrigger value="narrative" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Patient Narrative
          </TabsTrigger>
          <TabsTrigger value="treatment" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Treatment Plan
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Patient Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{ownerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patient ID:</span>
                  <span className="font-mono text-sm">{story.owner.clerkId.slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Story Type:</span>
                  <Badge variant={story.storyType === 'life_story' ? 'default' : 'secondary'}>
                    {story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline">{story.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(story.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>{new Date(story.updatedAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Engagement Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Views:</span>
                  <span className="font-medium">{story.viewCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audio Listens:</span>
                  <span className="font-medium">{story.listenCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Engagement Rate:</span>
                  <span className="font-medium">
                    {analytics?.engagementRate ? `${analytics.engagementRate.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                {analytics?.viewsByLanguage && Object.keys(analytics.viewsByLanguage).length > 0 && (
                  <div className="space-y-2">
                    <span className="text-muted-foreground">Language Preferences:</span>
                    <div className="space-y-1">
                      {Object.entries(analytics.viewsByLanguage).map(([lang, count]) => (
                        <div key={lang} className="flex justify-between text-sm">
                          <span>{lang}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {story.image && (
            <Card>
              <CardHeader>
                <CardTitle>Generated Story Image</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video relative w-full overflow-hidden rounded-lg border">
                  <Image
                    src={story.image.url}
                    alt={story.image.prompt}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2 italic">
                  Image prompt: &quot;{story.image.prompt}&quot;
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clinical" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Clinical Formulation & Analysis
              </CardTitle>
              <CardDescription>
                AI-generated psychiatric assessment and clinical insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {story.summary?.psySummary ? (
                <div className="prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap bg-muted/30 p-6 rounded-lg">
                    {story.summary.psySummary}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
                  <p>No clinical analysis available for this story</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="narrative" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Patient's Narrative
              </CardTitle>
              <CardDescription>
                The patient's own words and story content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {story.summary?.userSummary && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Patient Summary</h3>
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                      {story.summary.userSummary}
                    </div>
                  </div>
                </div>
              )}

              {story.summary?.longFormStory && (
                <div>
                  <Separator />
                  <h3 className="text-lg font-semibold mb-3">Full Story Content</h3>
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap bg-muted/30 p-6 rounded-lg">
                      {story.summary.longFormStory}
                    </div>
                  </div>
                </div>
              )}

              {story.content && story.storyType === 'blog_story' && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Blog Story Content</h3>
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap bg-muted/30 p-6 rounded-lg">
                      {story.content}
                    </div>
                  </div>
                </div>
              )}

              {!story.summary?.userSummary && !story.summary?.longFormStory && !story.content && (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4" />
                  <p>No narrative content available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treatment" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Treatment Plan & Recommendations
              </CardTitle>
              <CardDescription>
                Actionable steps and treatment recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {story.summary?.actionableSteps && story.summary.actionableSteps.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Recommended Actions</h3>
                  <ul className="space-y-4">
                    {story.summary.actionableSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="text-green-800 dark:text-green-200">
                          {typeof step === "string"
                            ? step
                            : String(Object.values(step)[0])}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4" />
                  <p>No treatment recommendations available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Viewing Analytics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Views:</span>
                    <span className="font-medium">{analytics?.totalViews || story.viewCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio Listens:</span>
                    <span className="font-medium">{analytics?.totalListens || story.listenCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Engagement Rate:</span>
                    <span className="font-medium">
                      {analytics?.engagementRate ? `${analytics.engagementRate.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  {analytics?.lastViewedAt && (
                    <div className="flex justify-between">
                      <span>Last Viewed:</span>
                      <span className="font-medium">
                        {new Date(analytics.lastViewedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {analytics?.viewsByLanguage && Object.keys(analytics.viewsByLanguage).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Headphones className="h-5 w-5" />
                    Language Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.viewsByLanguage)
                      .sort(([,a], [,b]) => b - a)
                      .map(([lang, count]) => (
                        <div key={lang} className="flex items-center justify-between">
                          <span className="capitalize">{lang}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ 
                                  width: `${(count / Math.max(...Object.values(analytics.viewsByLanguage))) * 100}%` 
                                }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
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
