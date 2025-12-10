"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Eye, Headphones, BookOpen, TrendingUp, Globe, Calendar, Share2 } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import Link from "next/link";

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
    totalShares: number;
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

const engagementChartConfig = {
  views: {
    label: "Views",
    color: "hsl(var(--chart-1))",
  },
  listens: {
    label: "Listens",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

const storyPerformanceChartConfig = {
  engagement: {
    label: "Total Engagement",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

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

  // Process recent activity for chart - group by date
  const activityByDate = recentActivity.reduce((acc, item) => {
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

  // Prepare chart data - fill in missing dates for the last 7 days
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const data = activityByDate[date] || { views: 0, listens: 0 };
    chartData.push({
      date,
      displayDate: format(subDays(new Date(), i), 'EEE'),
      views: data.views,
      listens: data.listens,
    });
  }

  // Prepare story performance data for bar chart
  const storyPerformanceData = stories
    .filter(story => story.status === 'published')
    .sort((a, b) => (b.viewCount + b.listenCount) - (a.viewCount + a.listenCount))
    .slice(0, 5)
    .map(story => ({
      name: (story.title || 'Untitled').slice(0, 15) + ((story.title?.length || 0) > 15 ? '...' : ''),
      fullName: story.title || 'Untitled',
      views: story.viewCount,
      listens: story.listenCount,
      engagement: story.viewCount + story.listenCount,
      id: story.id,
    }));

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
            <CardTitle className="text-sm font-medium">Total Shares</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement.totalShares}</div>
            <p className="text-xs text-muted-foreground">
              Stories shared by readers
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
      </div>

      {/* Weekly Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Activity
          </CardTitle>
          <CardDescription>
            Views and listens across all your stories in the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.some(d => d.views > 0 || d.listens > 0) ? (
            <ChartContainer config={engagementChartConfig} className="h-[250px] w-full">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="displayDate" 
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Area
                  type="monotone"
                  dataKey="views"
                  stackId="1"
                  stroke="var(--color-views)"
                  fill="var(--color-views)"
                  fillOpacity={0.4}
                />
                <Area
                  type="monotone"
                  dataKey="listens"
                  stackId="2"
                  stroke="var(--color-listens)"
                  fill="var(--color-listens)"
                  fillOpacity={0.4}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No activity in the last 7 days. Publish and share your stories to start tracking engagement.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Top Performing Stories Bar Chart */}
      {storyPerformanceData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Top Performing Stories
            </CardTitle>
            <CardDescription>
              Your most engaging published stories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={engagementChartConfig} className="h-[250px] w-full">
              <BarChart data={storyPerformanceData} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false}
                  width={100}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="views" fill="var(--color-views)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="listens" fill="var(--color-listens)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

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
            Individual story engagement metrics - click to view detailed analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stories
              .filter(story => story.status === 'published')
              .sort((a, b) => (b.viewCount + b.listenCount) - (a.viewCount + a.listenCount))
              .slice(0, 10) // Show top 10 performing stories
              .map((story) => (
                <Link key={story.id} href={`/analytics/${story.id}`}>
                  <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
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
                </Link>
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