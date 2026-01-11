"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, Eye, Headphones, Calendar, User, Heart, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type LikedStory = {
  id: string;
  title: string;
  storyType: 'life_story' | 'blog_story';
  summarySnippet: string;
  visibility: 'public_summary' | 'public_long';
  authorName: string;
  publishedAt: string;
  viewCount: number;
  listenCount: number;
  thumbnailImageUrl?: string;
  bannerImageUrl?: string;
  likedAt: string;
};

export default function LikedStoriesPage() {
  const { data: stories, isLoading } = useQuery<LikedStory[]>({
    queryKey: ['likedStories'],
    queryFn: async () => {
      const res = await fetch('/api/stories/liked');
      if (!res.ok) throw new Error("Failed to fetch liked stories");
      return res.json();
    }
  });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation */}
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <header className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="h-8 w-8 text-red-500 fill-red-500" />
          <h1 className="text-4xl font-bold tracking-tight">Liked Stories</h1>
        </div>
        <p className="text-lg text-muted-foreground">Stories you've shown love to.</p>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => <StorySkeleton key={i} />)}
        </div>
      )}

      {/* Stories Grid */}
      {!isLoading && stories && stories.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {stories.map(story => (
            <StoryCard key={story.id} story={story} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!stories || stories.length === 0) && (
        <div className="text-center py-12">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-semibold mb-2">No Liked Stories Yet</h2>
          <p className="text-muted-foreground mb-4">
            Explore public stories and like the ones you enjoy!
          </p>
          <Link href="/stories/public">
            <Button>
              <BookOpen className="mr-2 h-4 w-4" />
              Explore Stories
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}


function StoryCard({ story }: { story: LikedStory }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Link href={`/story/${story.id}`}>
      <Card className="h-full flex flex-col hover:border-primary transition-colors duration-200 group">
        {/* Thumbnail Image */}
        {story.thumbnailImageUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-t-lg">
            <img
              src={story.thumbnailImageUrl}
              alt={story.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              {story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
            </Badge>
            <Heart className="h-4 w-4 text-red-500 fill-red-500" />
          </div>
          <CardTitle className="flex items-start gap-2 text-lg leading-tight">
            <BookOpen className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{story.title}</span>
          </CardTitle>
          <CardDescription className="flex items-center gap-1 text-sm">
            <User className="h-3 w-3" />
            {story.authorName}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-grow pb-4">
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {story.summarySnippet}
          </p>

          {/* Story Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {story.viewCount}
              </div>
              {story.listenCount > 0 && (
                <div className="flex items-center gap-1">
                  <Headphones className="h-3 w-3" />
                  {story.listenCount}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(story.publishedAt)}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StorySkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <div className="aspect-video w-full">
        <Skeleton className="w-full h-full rounded-t-lg" />
      </div>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-4" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="flex-grow pb-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-3">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}
