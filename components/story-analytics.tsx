"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Eye, Headphones, Calendar, Globe, ArrowLeft, TrendingUp, MessageCircle, Heart, Share2 } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import Link from "next/link";
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
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface StoryAnalyticsData {
  story: {
    id: string;
    title: string | null;
    viewCount: number;
    listenCount: number;
    shareCount: number;
    commentCount: number;
    likeCount: number;
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

const LANGUAGE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

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

  // Prepare chart data - fill in missing dates with zeros for the last 30 days
  const chartData = [];
  for (let i = 29; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
    const data = engagementByDate[date] || { views: 0, listens: 0 };
    chartData.push({
      date,
      displayDate: format(parseISO(date), 'MMM d'),
      views: data.views,
      listens: data.listens,
    });
  }

  // Prepare language pie chart data
  const languagePieData = languagePreferences.map((lang, index) => ({
    name: languageNames[lang.languageCode || ''] || lang.languageCode || 'Unknown',
    value: lang.count,
    fill: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
  }));

  const languageChartConfig = languagePreferences.reduce((acc, lang, index) => {
    const key = lang.languageCode || 'unknown';
    acc[key] = {
      label: languageNames[lang.languageCode || ''] || lang.languageCode || 'Unknown',
      color: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
    };
    return acc;
  }, {} as ChartConfig);

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
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-7">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{story.viewCount}</div>
            <p className="text-xs text-muted-foreground">
              Page visits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Listens</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{story.listenCount}</div>
            <p className="text-xs text-muted-foreground">
              Audio plays
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{story.commentCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Discussions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Likes</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{story.likeCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Reactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shares</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{story.shareCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Times shared
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{engagementRate}%</div>
            <p className="text-xs text-muted-foreground">
              Listen rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagement}</div>
            <p className="text-xs text-muted-foreground">
              Interactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Language Preferences Pie Chart */}
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
            <div className="grid md:grid-cols-2 gap-6">
              <ChartContainer config={languageChartConfig} className="h-[200px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={languagePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                  >
                    {languagePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="space-y-3">
                {languagePreferences
                  .sort((a, b) => b.count - a.count)
                  .map((lang, index) => {
                    const percentage = ((lang.count / story.listenCount) * 100).toFixed(1);
                    return (
                      <div key={lang.languageCode || 'unknown'} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] }}
                          />
                          <span className="font-medium">
                            {languageNames[lang.languageCode || ''] || lang.languageCode || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">{percentage}%</span>
                          <Badge variant="secondary">{lang.count}</Badge>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Engagement Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Engagement (Last 30 Days)</CardTitle>
          <CardDescription>
            Daily views and listens for this story
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.some(d => d.views > 0 || d.listens > 0) ? (
            <ChartContainer config={engagementChartConfig} className="h-[300px] w-full">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="displayDate" 
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  interval="preserveStartEnd"
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
              No engagement data available for the last 30 days. Share your story to start tracking views and listens.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}