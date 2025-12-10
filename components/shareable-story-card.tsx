"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/share-button";
import { LikeButton } from "@/components/like-button";
import { BookOpen, Eye, Headphones, Heart, Calendar, User, ExternalLink, Share2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface ShareableStoryCardProps {
  story: {
    id: string;
    title: string;
    storyType: "life_story" | "blog_story";
    summarySnippet?: string;
    thumbnailImageUrl?: string | null;
    bannerImageUrl?: string | null;
    authorName: string;
    publishedAt: string;
    viewCount: number;
    listenCount?: number;
    likeCount?: number;
    shareCount?: number;
  };
  showShareButton?: boolean;
  showLikeButton?: boolean;
  variant?: "default" | "compact" | "featured";
  className?: string;
}

export function ShareableStoryCard({
  story,
  showShareButton = true,
  showLikeButton = true,
  variant = "default",
  className,
}: ShareableStoryCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const imageUrl = story.thumbnailImageUrl || story.bannerImageUrl;

  if (variant === "compact") {
    return (
      <Card className={`flex flex-row overflow-hidden hover:border-primary/50 transition-colors ${className}`}>
        {/* Compact Image */}
        {imageUrl && (
          <div className="w-24 h-24 flex-shrink-0 relative">
            <Image
              src={imageUrl}
              alt={story.title}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
        )}
        
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Badge variant="outline" className="text-xs mb-1">
                {story.storyType === "life_story" ? "Life Story" : "Blog"}
              </Badge>
              <Link href={`/story/${story.id}`}>
                <h3 className="font-medium text-sm line-clamp-1 hover:text-primary transition-colors">
                  {story.title}
                </h3>
              </Link>
              <p className="text-xs text-muted-foreground line-clamp-1">
                by {story.authorName}
              </p>
            </div>
            {showShareButton && (
              <ShareButton
                storyId={story.id}
                storyTitle={story.title}
                storyDescription={story.summarySnippet}
                variant="ghost"
                size="icon"
                showLabel={false}
              />
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (variant === "featured") {
    return (
      <Card className={`overflow-hidden hover:shadow-lg transition-all duration-300 ${className}`}>
        {/* Featured Image - Larger */}
        {imageUrl && (
          <div className="aspect-[16/9] w-full relative">
            <Image
              src={imageUrl}
              alt={story.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Overlay Content */}
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <Badge variant="secondary" className="mb-2">
                {story.storyType === "life_story" ? "Life Story" : "Blog Story"}
              </Badge>
              <h3 className="text-xl font-bold line-clamp-2 mb-1">{story.title}</h3>
              <p className="text-sm opacity-90">by {story.authorName}</p>
            </div>
          </div>
        )}
        
        <CardContent className="p-4">
          {story.summarySnippet && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {story.summarySnippet}
            </p>
          )}
          
          {/* Stats and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {story.viewCount.toLocaleString()}
              </span>
              {(story.listenCount ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Headphones className="h-3 w-3" />
                  {story.listenCount?.toLocaleString()}
                </span>
              )}
              {(story.likeCount ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {story.likeCount?.toLocaleString()}
                </span>
              )}
              {(story.shareCount ?? 0) > 0 && (
                <span className="flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  {story.shareCount?.toLocaleString()}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {showLikeButton && <LikeButton storyId={story.id} variant="ghost" size="sm" />}
              {showShareButton && (
                <ShareButton
                  storyId={story.id}
                  storyTitle={story.title}
                  storyDescription={story.summarySnippet}
                  variant="ghost"
                  size="sm"
                  showLabel={false}
                />
              )}
              <Link href={`/story/${story.id}`}>
                <Button variant="ghost" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className={`h-full flex flex-col overflow-hidden hover:border-primary/50 hover:shadow-md transition-all duration-200 group ${className}`}>
      {/* Thumbnail Image */}
      {imageUrl ? (
        <div className="aspect-video w-full overflow-hidden relative">
          <Image
            src={imageUrl}
            alt={story.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="aspect-video w-full bg-muted flex items-center justify-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/50" />
        </div>
      )}

      <CardHeader className="pb-2 flex-grow">
        <div className="flex items-start justify-between gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {story.storyType === "life_story" ? "Life Story" : "Blog Story"}
          </Badge>
        </div>
        <Link href={`/story/${story.id}`}>
          <h3 className="font-semibold text-lg leading-tight line-clamp-2 hover:text-primary transition-colors">
            {story.title}
          </h3>
        </Link>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <User className="h-3 w-3" />
          {story.authorName}
        </p>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        {story.summarySnippet && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {story.summarySnippet}
          </p>
        )}

        {/* Stats Row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {story.viewCount.toLocaleString()}
            </span>
            {(story.listenCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Headphones className="h-3 w-3" />
                {story.listenCount?.toLocaleString()}
              </span>
            )}
            {(story.likeCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {story.likeCount?.toLocaleString()}
              </span>
            )}
            {(story.shareCount ?? 0) > 0 && (
              <span className="flex items-center gap-1">
                <Share2 className="h-3 w-3" />
                {story.shareCount?.toLocaleString()}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(story.publishedAt)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Link href={`/story/${story.id}`}>
            <Button variant="link" size="sm" className="px-0 h-auto">
              Read Story
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            {showLikeButton && <LikeButton storyId={story.id} variant="ghost" size="sm" />}
            {showShareButton && (
              <ShareButton
                storyId={story.id}
                storyTitle={story.title}
                storyDescription={story.summarySnippet}
                variant="ghost"
                size="sm"
                showLabel={false}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
