"use client";

import { Button, LoadingButton } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Share2,
  ShieldCheck,
  Calendar,
  Eye,
  Headphones,
  User,
  Clock,
  ArrowLeft,
  Package,
  Flag
} from "lucide-react";
import { LikeButton } from "@/components/like-button";
import Image from "next/image";

import Link from "next/link";
import { toast } from "sonner";
import { useState, useEffect, useCallback, useRef } from "react";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentsSection } from "@/components/comments-section";
import { StoryAudioSection } from "@/components/story-audio-section";
import { HighlightedStoryContent } from "@/components/highlighted-story-content";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { ShareButton } from "@/components/share-button";
import { PrintOrderDialog } from "@/components/print-order-dialog";
import { ReportContentDialog } from "@/components/report-content-dialog";

type StoryImage = { url: string; prompt: string };
type StorySummary = {
  userSummary: string;
  psySummary: string;
  actionableSteps: (string | { [key: string]: string })[];
  longFormStory?: string;
};

type FullStory = {
  id: string;
  title: string | null;
  content: string | null;
  storyType: 'life_story' | 'blog_story';
  image: StoryImage | null;
  summary: StorySummary | null;
  status: "draft" | "completed" | "pending_review" | "published" | "rejected";
  visibility: "private" | "public_summary" | "public_long";
  bannerImageUrl: string | null;
  thumbnailImageUrl: string | null;
  publishedAt: string | null;
  viewCount: number;
  listenCount: number;
  shareCount?: number;
  owner: {
    id: string;
    clerkId: string;
    firstName: string | null;
    lastName: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

type RelatedStory = {
  id: string;
  title: string;
  thumbnailImageUrl: string | null;
  authorName: string;
  publishedAt: string;
  viewCount: number;
  storyType: 'life_story' | 'blog_story';
};

interface EnhancedStoryViewerProps {
  story: FullStory;
  isOwner?: boolean;
}

// Custom markdown components for optimal rendering
const MarkdownComponents = {
  // Headings with proper styling
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-3xl md:text-4xl font-bold mt-8 mb-4 text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-2xl md:text-3xl font-semibold mt-6 mb-3 text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-xl md:text-2xl font-semibold mt-5 mb-2 text-foreground">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-lg md:text-xl font-medium mt-4 mb-2 text-foreground">{children}</h4>
  ),

  // Paragraphs with proper spacing
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-base md:text-lg leading-relaxed mb-4 text-foreground/90">{children}</p>
  ),

  // Lists
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-base md:text-lg leading-relaxed text-foreground/90">{children}</li>
  ),

  // Blockquotes
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 py-2 my-4 italic text-muted-foreground bg-muted/30 rounded-r-lg">
      {children}
    </blockquote>
  ),

  // Code blocks
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted rounded-lg overflow-x-auto my-4">{children}</pre>
  ),

  // Links
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      className="text-primary hover:underline font-medium"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),

  // Images with optimal placement
  img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    const src = typeof props.src === 'string' ? props.src : undefined;
    const alt = props.alt;
    return (
      <figure className="my-6 md:my-8">
        <div className="relative w-full aspect-video md:aspect-[16/9] rounded-lg overflow-hidden shadow-lg">
          <Image
            src={src || "/placeholder.svg"}
            alt={alt || "Story image"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
          />
        </div>
        {alt && (
          <figcaption className="text-center text-sm text-muted-foreground mt-2 italic">
            {alt}
          </figcaption>
        )}
      </figure>
    );
  },

  // Horizontal rule
  hr: () => <Separator className="my-8" />,

  // Strong and emphasis
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),

  // Tables
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse border border-border rounded-lg">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-4 py-2">{children}</td>
  ),
};


export function EnhancedStoryViewer({ story, isOwner = false }: EnhancedStoryViewerProps) {
  const [localShareCount, setLocalShareCount] = useState(story.shareCount ?? 0);

  // Text highlighting state for audio sync (Requirement 8.6)
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle share count updates
  const handleShare = useCallback(() => {
    setLocalShareCount(prev => prev + 1);
  }, []);

  // Handle audio time updates for text highlighting
  const handleAudioTimeUpdate = useCallback((currentTime: number, isPlaying: boolean) => {
    setAudioCurrentTime(currentTime);
    setIsAudioPlaying(isPlaying);
  }, []);

  // Handle highlight toggle
  const handleHighlightToggle = useCallback((enabled: boolean) => {
    setHighlightEnabled(enabled);
    if (enabled) {
      toast.success("Text highlighting enabled. Text will sync with audio playback.");
    }
  }, []);

  // Fetch related stories
  const { data: relatedStories } = useQuery<RelatedStory[]>({
    queryKey: ["relatedStories", story.id],
    queryFn: async () => {
      const res = await fetch(`/api/stories/${story.id}/related`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: story.status === "published",
  });

  // Schedule appointment mutation
  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.id }),
      });
      if (!res.ok) {
        if (res.status === 409) throw new Error("An appointment request already exists for this story.");
        throw new Error("Failed to schedule session.");
      }
      return res.json();
    },
    onSuccess: () => toast.success("Request sent! You'll be notified when an expert confirms."),
    onError: (error: Error) => toast.error(error.message),
  });

  // Get complete story content for audio
  const getCompleteStoryText = useCallback((): string => {
    let fullText = '';

    if (story.storyType === 'blog_story') {
      fullText = story.content || '';
    } else {
      const parts = [];
      if (story.title) parts.push(story.title);
      if (story.summary?.longFormStory) {
        parts.push(story.summary.longFormStory);
      } else if (story.summary?.userSummary) {
        parts.push(story.summary.userSummary);
      }
      if (story.summary?.psySummary) {
        parts.push('Psychological Insights: ' + story.summary.psySummary);
      }
      if (story.summary?.actionableSteps && story.summary.actionableSteps.length > 0) {
        parts.push('Action Steps: ' + story.summary.actionableSteps.map((step, i) =>
          `${i + 1}. ${typeof step === 'string' ? step : JSON.stringify(step)}`
        ).join(' '));
      }
      fullText = parts.join('\n\n');
    }

    return fullText;
  }, [story]);

  // Track story view
  useEffect(() => {
    if (story.status === "published" && !isOwner) {
      fetch(`/api/stories/${story.id}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'view' })
      }).catch(() => { });
    }
  }, [story.id, story.status, isOwner]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getReadingTime = (text: string) => {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  const authorName = story.owner.firstName && story.owner.lastName
    ? `${story.owner.firstName} ${story.owner.lastName}`
    : story.owner.firstName || "Anonymous";

  const displayContent = story.storyType === 'blog_story'
    ? story.content
    : story.summary?.longFormStory || story.summary?.userSummary;

  const readingTime = displayContent ? getReadingTime(displayContent) : 0;


  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-6xl mx-auto py-3 px-4 flex items-center justify-between">
          <Link
            href="/stories/public"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Stories</span>
            <span className="sm:hidden">Back</span>
          </Link>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {story.status === "published" && (
              <LikeButton storyId={story.id} variant="ghost" size="sm" />
            )}

            <ShareButton
              storyId={story.id}
              storyTitle={story.title || "Untitled Story"}
              storyDescription={displayContent?.slice(0, 160)}
              variant="ghost"
              size="sm"
              showCount={true}
              shareCount={localShareCount}
              onShare={handleShare}
            />
          </div>
        </div>
      </nav>

      <article className="max-w-5xl mx-auto py-6 md:py-10 px-4 lg:px-8">
        {/* Hero Banner Image */}
        {(story.bannerImageUrl || story.image?.url) && (
          <div className="mb-6 md:mb-10">
            <div className="aspect-[21/9] md:aspect-[2/1] relative w-full overflow-hidden rounded-xl md:rounded-2xl shadow-xl">
              <Image
                src={story.bannerImageUrl || story.image?.url || "/placeholder.svg"}
                alt={story.title || "Story banner"}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
              />
              {/* Gradient overlay for better text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
            {story.image?.prompt && (
              <p className="text-xs md:text-sm text-muted-foreground mt-3 italic text-center">
                Inspired by: &quot;{story.image.prompt}&quot;
              </p>
            )}
          </div>
        )}

        {/* Story Header */}
        <header className="mb-8 md:mb-12">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="outline" className="text-xs">
              {story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
            </Badge>
            {story.visibility === "private" ? (
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <ShieldCheck className="h-3 w-3" />
                Private
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1 text-xs">
                <BookOpen className="h-3 w-3" />
                Public
              </Badge>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 md:mb-6 leading-tight">
            {story.title || "Untitled Story"}
          </h1>

          {/* Author & Metadata */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">{authorName}</p>
                {story.publishedAt && (
                  <p className="text-xs">{formatDate(story.publishedAt)}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
              {readingTime > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{readingTime} min read</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{story.viewCount.toLocaleString()} views</span>
              </div>
              {story.listenCount > 0 && (
                <div className="flex items-center gap-1">
                  <Headphones className="h-4 w-4" />
                  <span>{story.listenCount.toLocaleString()} listens</span>
                </div>
              )}
              {localShareCount > 0 && (
                <div className="flex items-center gap-1">
                  <Share2 className="h-4 w-4" />
                  <span>{localShareCount.toLocaleString()} shares</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {isOwner && (
              <Button onClick={() => window.location.href = `/publish/${story.id}`} size="sm">
                <Share2 className="mr-2 h-4 w-4" />
                Manage Publication
              </Button>
            )}

            {story.storyType === 'life_story' && story.status === 'completed' && isOwner && (
              <LoadingButton
                variant="outline"
                size="sm"
                onClick={() => scheduleMutation.mutate()}
                loading={scheduleMutation.isPending}
                icon={<Calendar className="h-4 w-4" />}
              >
                Talk to Expert
              </LoadingButton>
            )}

            {/* Print Order Button - Available for completed/published stories */}
            {(story.status === 'completed' || story.status === 'published') && (
              <PrintOrderDialog
                storyId={story.id}
                storyTitle={story.title || "Untitled Story"}
                trigger={
                  <Button variant="outline" size="sm">
                    <Package className="mr-2 h-4 w-4" />
                    Order Print Copy
                  </Button>
                }
              />
            )}

            {/* Report Button - Available for non-owners on published stories */}
            {!isOwner && story.status === 'published' && (
              <ReportContentDialog
                contentType="story"
                contentId={story.id}
                trigger={
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    <Flag className="mr-2 h-4 w-4" />
                    Report
                  </Button>
                }
              />
            )}
          </div>
        </header>

        <Separator className="mb-8" />

        {/* Audio Player Section */}
        {displayContent && (
          <StoryAudioSection
            storyId={story.id}
            storyContent={getCompleteStoryText()}
            storyStatus={story.status}
            isOwner={isOwner}
            className="mb-8"
            onAudioTimeUpdate={handleAudioTimeUpdate}
            highlightEnabled={highlightEnabled}
            onHighlightToggle={handleHighlightToggle}
          />
        )}


        {/* Story Content */}
        <div className="story-content" ref={contentRef}>
          {story.storyType === 'blog_story' ? (
            // Blog story - render markdown or highlighted content
            story.content ? (
              highlightEnabled && isAudioPlaying ? (
                // Show highlighted content when audio is playing and highlighting is enabled
                <HighlightedStoryContent
                  content={getCompleteStoryText()}
                  currentTime={audioCurrentTime}
                  isPlaying={isAudioPlaying}
                  highlightEnabled={highlightEnabled}
                  wordsPerMinute={150}
                  scrollOffset={120}
                  className="prose prose-lg dark:prose-invert max-w-none"
                />
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={MarkdownComponents}
                >
                  {story.content}
                </ReactMarkdown>
              )
            ) : (
              <p className="text-muted-foreground italic text-center py-8">
                No content available.
              </p>
            )
          ) : (
            // Life story content with tabs
            story.summary ? (
              <Tabs defaultValue="narrative" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="narrative" className="text-sm">
                    Your Narrative
                  </TabsTrigger>
                  <TabsTrigger value="steps" className="text-sm">
                    Your Path Forward
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="narrative" className="pt-4">
                  {story.summary.longFormStory ? (
                    <Tabs defaultValue="long-form" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="long-form" className="text-sm">
                          Full Story
                        </TabsTrigger>
                        <TabsTrigger value="user-summary" className="text-sm">
                          Summary
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="long-form">
                        {highlightEnabled && isAudioPlaying ? (
                          <HighlightedStoryContent
                            content={getCompleteStoryText()}
                            currentTime={audioCurrentTime}
                            isPlaying={isAudioPlaying}
                            highlightEnabled={highlightEnabled}
                            wordsPerMinute={150}
                            scrollOffset={120}
                            className="prose prose-lg dark:prose-invert max-w-none"
                          />
                        ) : (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                            components={MarkdownComponents}
                          >
                            {story.summary.longFormStory}
                          </ReactMarkdown>
                        )}
                      </TabsContent>
                      <TabsContent value="user-summary">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={MarkdownComponents}
                        >
                          {story.summary.userSummary}
                        </ReactMarkdown>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    highlightEnabled && isAudioPlaying ? (
                      <HighlightedStoryContent
                        content={getCompleteStoryText()}
                        currentTime={audioCurrentTime}
                        isPlaying={isAudioPlaying}
                        highlightEnabled={highlightEnabled}
                        wordsPerMinute={150}
                        scrollOffset={120}
                        className="prose prose-lg dark:prose-invert max-w-none"
                      />
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                        components={MarkdownComponents}
                      >
                        {story.summary.userSummary}
                      </ReactMarkdown>
                    )
                  )}
                </TabsContent>

                <TabsContent value="steps" className="pt-4">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold mb-4">Actionable Steps</h3>
                    <ul className="space-y-3">
                      {(story.summary.actionableSteps || []).map((step, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg border"
                        >
                          <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                            {i + 1}
                          </span>
                          <span className="text-base leading-relaxed text-foreground/90">
                            {typeof step === "string" ? step : JSON.stringify(step)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-4" />
                  <div className="h-4 bg-muted rounded w-1/2 mx-auto mb-4" />
                  <div className="h-4 bg-muted rounded w-2/3 mx-auto" />
                </div>
                <p className="text-muted-foreground italic mt-6">
                  Story content is being generated...
                </p>
              </div>
            )
          )}
        </div>

        {/* Comments Section */}
        {story.status === "published" && (
          <section className="mt-12 md:mt-16">
            <Separator className="mb-8" />
            <CommentsSection
              storyId={story.id}
              storyOwnerId={story.owner.clerkId}
            />
          </section>
        )}

        {/* Related Stories */}
        {relatedStories && relatedStories.length > 0 && (
          <section className="mt-12 md:mt-16">
            <Separator className="mb-8" />
            <h2 className="text-2xl font-bold mb-6">Related Stories</h2>
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {relatedStories.map(relatedStory => (
                <RelatedStoryCard key={relatedStory.id} story={relatedStory} />
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}


function RelatedStoryCard({ story }: { story: RelatedStory }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Link href={`/story/${story.id}`}>
      <Card className="h-full flex flex-col hover:border-primary/50 hover:shadow-md transition-all duration-200 group overflow-hidden">
        {story.thumbnailImageUrl ? (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={story.thumbnailImageUrl}
              alt={story.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
              {story.storyType === 'life_story' ? 'Life Story' : 'Blog'}
            </Badge>
          </div>
          <CardTitle className="text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {story.title}
          </CardTitle>
          <CardDescription className="flex items-center gap-1 text-xs mt-1">
            <User className="h-3 w-3" />
            {story.authorName}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {story.viewCount.toLocaleString()}
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
