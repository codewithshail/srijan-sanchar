"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Eye, Headphones, BookOpen, TrendingUp, Globe, Calendar } from "lucide-react";
import { format, parseISO } from "date-fns";

interface AnalyticsData {
  stories: Array<{
    id: string;
    title: string | null;
    storyType: "life_story" | "blog_story";
    status: string;
    viewCount: number;
    listenCount: number;
    publishedAt: string | null;
    createdAt: string;
  }>;
  totalEngagement: {
    totalViews: number;
    totalListens: number;
    publishedCount: number;
    totalStories: number;
  };
  recentActivity: Array<{
    date: string;
    eventType: string;
    count: number;
  }>;
  languagePreferences: Array<{
    languageCode: string | null;
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

export function AnalyticsDashboard() {
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["userAnalytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">
            Failed to load analytics data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { totalEngagement, recentActivity, languagePreferences, stories } = analytics;

  // Process recent activity data for simple display
  const activityByType = recentActivity.reduce((acc, item) => {
    acc[item.eventType] = (acc[item.eventType] || 0) + item.count;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement.totalViews}</div>
            <p className="text-xs text-muted-foreground">
              Across {totalEngagement.publishedCount} published stories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listens</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement.totalListens}</div>
            <p className="text-xs text-muted-foreground">
              Audio engagement across stories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Published Stories</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement.publishedCount}</div>
            <p className="text-xs text-muted-foreground">
              Out of {totalEngagement.totalStories} total stories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(activityByType.view || 0) + (activityByType.listen || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days engagement
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
              Audio listening preferences across your stories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {languagePreferences
                .sort((a, b) => b.count - a.count)
                .map((lang) => (
                  <Badge key={lang.languageCode || 'unknown'} variant="secondary">
                    {languageNames[lang.languageCode || ''] || lang.languageCode || 'Unknown'}: {lang.count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Story Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Story Performance
          </CardTitle>
          <CardDescription>
            Individual story engagement metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stories
              .filter(story => story.status === 'published')
              .sort((a, b) => (b.viewCount + b.listenCount) - (a.viewCount + a.listenCount))
              .slice(0, 10) // Show top 10 performing stories
              .map((story) => (
                <div key={story.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium">{story.title || "Untitled Story"}</h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <Badge variant="outline" className="text-xs">
                        {story.storyType === 'blog_story' ? 'Creative Story' : 'Life Story'}
                      </Badge>
                      {story.publishedAt && (
                        <span>Published {format(parseISO(story.publishedAt), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                      <span>{story.viewCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Headphones className="h-4 w-4 text-muted-foreground" />
                      <span>{story.listenCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            {stories.filter(story => story.status === 'published').length === 0 && (
              <p className="text-muted-foreground text-center py-4">
                No published stories yet. Publish a story to see engagement metrics.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}