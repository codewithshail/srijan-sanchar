"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Eye, Headphones, Calendar, Globe, ArrowLeft, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import Link from "next/link";

interface StoryAnalyticsData {
  story: {
    id: string;
    title: string | null;
    viewCount: number;
    listenCount: number;
    publishedAt: string | null;
    status: string;
  };
  analytics: Array<{
    eventType: string;
    languageCode: string | null;
    createdAt: string;
  }>;
  languagePreferences: Array<{
    languageCode: string | null;
    count: number;
  }>;
  dailyEngagement: Array<{
    date: string;
    eventType: string;
    count: number;
  }>;
}

const languageNames: Record<string, string> = {
  'en-IN': 'English',
  'hi-IN': 'Hindi',
  'bn-IN': 'Bengali',
  'ta-IN': 'Tamil',
  'te-IN': 'Telugu',
  'gu-IN': 'Gujarati',
  'kn-IN': 'Kannada',
  'ml-IN': 'Malayalam',
  'mr-IN': 'Marathi',
  'pa-IN': 'Punjabi',
  'or-IN': 'Odia',
};

interface StoryAnalyticsProps {
  storyId: string;
}

export function StoryAnalytics({ storyId }: StoryAnalyticsProps) {
  const { data: analytics, isLoading, error } = useQuery<StoryAnalyticsData>({
    queryKey: ["storyAnalytics", storyId],
    queryFn: async () => {
      const res = await fetch(`/api/stories/${storyId}/analytics`);
      if (!res.ok) throw new Error("Failed to fetch story analytics");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-muted rounded animate-pulse"></div>
          <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">
              Failed to load analytics data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { story, languagePreferences, dailyEngagement } = analytics;

  // Process daily engagement data
  const engagementByDate = dailyEngagement.reduce((acc, item) => {
    if (!acc[item.date]) {
      acc[item.date] = { views: 0, listens: 0 };
    }
    if (item.eventType === 'view') {
      acc[item.date].views = item.count;
    } else if (item.eventType === 'listen') {
      acc[item.date].listens = item.count;
    }
    return acc;
  }, {} as Record<string, { views: number; listens: number }>);

  const sortedDates = Object.keys(engagementByDate).sort();
  const totalEngagement = story.viewCount + story.listenCount;
  const engagementRate = story.viewCount > 0 ? (story.listenCount / story.viewCount * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{story.title || "Untitled Story"}</h1>
            <p className="text-muted-foreground">
              {story.publishedAt 
                ? `Published ${format(parseISO(story.publishedAt), 'MMMM d, yyyy')}`
                : 'Not published'
              }
            </p>
          </div>
        </div>
        <Badge variant={story.status === 'published' ? 'default' : 'secondary'}>
          {story.status}
        </Badge>
      </div>

      {story.status !== 'published' && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-yellow-800">
              This story is not published yet. Analytics will be available once the story is published and starts receiving engagement.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{story.viewCount}</div>
            <p className="text-xs text-muted-foreground">
              Story page visits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listens</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{story.listenCount}</div>
            <p className="text-xs text-muted-foreground">
              Audio playbacks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementRate}%</div>
            <p className="text-xs text-muted-foreground">
              Listen to view ratio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Engagement</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement}</div>
            <p className="text-xs text-muted-foreground">
              Combined interactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Language Preferences */}
      {languagePreferences.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Language Preferences
            </CardTitle>
            <CardDescription>
              Languages used for audio playback of this story
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {languagePreferences
                .sort((a, b) => b.count - a.count)
                .map((lang) => {
                  const percentage = ((lang.count / story.listenCount) * 100).toFixed(1);
                  return (
                    <div key={lang.languageCode || 'unknown'} className="flex items-center justify-between">
                      <span className="font-medium">
                        {languageNames[lang.languageCode || ''] || lang.languageCode || 'Unknown'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{percentage}%</span>
                        <Badge variant="secondary">{lang.count} listens</Badge>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Engagement Trend */}
      {sortedDates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Engagement (Last 30 Days)</CardTitle>
            <CardDescription>
              Daily views and listens for this story
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedDates.slice(-10).map((date) => {
                const data = engagementByDate[date];
                return (
                  <div key={date} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">
                      {format(parseISO(date), 'MMM d, yyyy')}
                    </span>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        <span>{data.views}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Headphones className="h-4 w-4 text-muted-foreground" />
                        <span>{data.listens}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sortedDates.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No engagement data available for the last 30 days.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}