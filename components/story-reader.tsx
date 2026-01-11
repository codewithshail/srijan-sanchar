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
  Languages,
  Calendar,
  Eye,
  Headphones,
  User,
  Clock,
  ArrowLeft,
  Heart
} from "lucide-react";
import { LikeButton } from "@/components/like-button";
import Image from "next/image";
import { SUPPORTED_TTS_LANGUAGES as SUPPORTED_LANGUAGES } from "@/lib/ai/constants";
import { AudioPlayer } from "@/components/audio-player";
import { SequentialAudioPlayer } from "@/components/sequential-audio-player";
import { useStreamingTTS } from "@/hooks/use-streaming-tts";
import { LanguageSelector } from "@/components/language-selector";
import Link from "next/link";
import { toast } from "sonner";
import { useState } from "react";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentsSection } from "@/components/comments-section";

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

interface StoryReaderProps {
  story: FullStory;
  isOwner?: boolean;
  onLanguageChange?: (language: string) => void;
  onPlayAudio?: () => void;
  onPauseAudio?: () => void;
}

export function StoryReader({ story, isOwner = false }: StoryReaderProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("en-IN");
  const [audioData, setAudioData] = useState<ArrayBuffer | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const streamingTTS = useStreamingTTS();

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
    onError: (error: any) => toast.error(error.message),
  });

  // Enhanced TTS functionality with Sarvam AI
  // Helper function to strip HTML tags and clean text for TTS
  const cleanTextForTTS = (htmlText: string): string => {
    if (!htmlText) return '';

    // Remove HTML tags
    const withoutTags = htmlText.replace(/<[^>]*>/g, ' ');
    // Replace multiple spaces with single space
    const normalized = withoutTags.replace(/\s+/g, ' ');
    // Trim and return
    return normalized.trim();
  };

  // Get complete story content for TTS
  const getCompleteStoryText = (): string => {
    let fullText = '';

    if (story.storyType === 'blog_story') {
      // For blog stories, use the content
      fullText = story.content || '';
    } else {
      // For life stories, combine all available content
      const parts = [];

      // Add title if available
      if (story.title) {
        parts.push(story.title);
      }

      // Add long form story if available, otherwise user summary
      if (story.summary?.longFormStory) {
        parts.push(story.summary.longFormStory);
      } else if (story.summary?.userSummary) {
        parts.push(story.summary.userSummary);
      }

      // Add psychological summary if available
      if (story.summary?.psySummary) {
        parts.push('Psychological Insights: ' + story.summary.psySummary);
      }

      // Add actionable steps if available
      if (story.summary?.actionableSteps && story.summary.actionableSteps.length > 0) {
        parts.push('Action Steps: ' + story.summary.actionableSteps.map((step, i) =>
          `${i + 1}. ${typeof step === 'string' ? step : JSON.stringify(step)}`
        ).join(' '));
      }

      fullText = parts.join('\n\n');
    }

    return fullText;
  };

  const generateAudio = async (text: string, language: string) => {
    setIsGeneratingAudio(true);
    setAudioData(null);

    // Get complete story text instead of just display content
    const completeText = getCompleteStoryText();
    const cleanText = cleanTextForTTS(completeText);

    console.log('[TTS] Story type:', story.storyType);
    console.log('[TTS] Story content length:', story.content?.length || 0);
    console.log('[TTS] Story summary longForm length:', story.summary?.longFormStory?.length || 0);
    console.log('[TTS] Story summary user length:', story.summary?.userSummary?.length || 0);
    console.log('[TTS] Complete story text length:', completeText.length);
    console.log('[TTS] Clean text length:', cleanText.length);
    console.log('[TTS] Clean text preview:', cleanText.substring(0, 300) + '...');
    console.log('[TTS] Clean text full:', cleanText);
    console.log('[TTS] Selected language:', language);

    if (!cleanText || cleanText.length < 10) {
      toast.error('No content available for audio generation');
      setIsGeneratingAudio(false);
      return;
    }

    try {
      // Check if we need translation (if selected language is not English)
      const needsTranslation = language !== 'en-IN' && language !== 'en-US';

      // Always use streaming for all content (with or without translation)
      console.log('[TTS] Using streaming for all content (length:', cleanText.length, ')');
      console.log('[TTS] Translation needed:', needsTranslation);

      await streamingTTS.startStreaming({
        text: cleanText,
        language,
        speaker: "anushka",
        pitch: 0,
        pace: 1.0,
      });

      // Track listen event when TTS starts
      if (story.status === "published") {
        fetch(`/api/stories/${story.id}/analytics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'listen',
            languageCode: language
          })
        }).catch(console.error);
      }

    } catch (error) {
      console.error('TTS generation error:', error);
      toast.error('Failed to generate audio. Please try again.');
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Track story view when component mounts
  React.useEffect(() => {
    if (story.status === "published" && !isOwner) {
      fetch(`/api/stories/${story.id}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'view' })
      }).catch(console.error);
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
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    return minutes;
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
      <div className="border-b">
        <div className="container py-4">
          <Link href="/stories/public" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Stories
          </Link>
        </div>
      </div>

      <article className="max-w-5xl mx-auto py-8 px-4 lg:px-8">
        {/* Banner Image */}
        {(story.bannerImageUrl || story.image?.url) && (
          <div className="mb-8">
            <div className="aspect-[2/1] relative w-full overflow-hidden rounded-lg border shadow-lg">
              <Image
                src={story.bannerImageUrl || story.image?.url || "/placeholder.svg"}
                alt={story.title || "Story banner"}
                fill
                className="object-cover"
                priority
              />
            </div>
            {story.image?.prompt && (
              <p className="text-sm text-muted-foreground mt-2 italic text-center">
                Inspired by: &quot;{story.image.prompt}&quot;
              </p>
            )}
          </div>
        )}

        {/* Story Header */}
        <header className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="outline">
              {story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
            </Badge>
            {story.visibility === "private" ? (
              <Badge variant="secondary" className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" />
                Private
              </Badge>
            ) : (
              <Badge variant="default" className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Public
              </Badge>
            )}
          </div>

          <h1 className="text-4xl font-bold tracking-tight mb-4">
            {story.title || "Untitled Story"}
          </h1>

          {/* Story Metadata */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>By {authorName}</span>
            </div>
            {story.publishedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(story.publishedAt)}</span>
              </div>
            )}
            {readingTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{readingTime} min read</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              <span>{story.viewCount} views</span>
            </div>
            {story.listenCount > 0 && (
              <div className="flex items-center gap-1">
                <Headphones className="h-4 w-4" />
                <span>{story.listenCount} listens</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Like Button - Show for published stories */}
            {story.status === "published" && (
              <LikeButton storyId={story.id} variant="outline" />
            )}

            {isOwner && (
              <Button onClick={() => window.location.href = `/publish/${story.id}`}>
                <Share2 className="mr-2 h-4 w-4" />
                Manage Publication
              </Button>
            )}

            {story.storyType === 'life_story' && story.status === 'completed' && isOwner && (
              <LoadingButton
                variant="outline"
                onClick={() => scheduleMutation.mutate()}
                loading={scheduleMutation.isPending}
                icon={<Calendar className="h-4 w-4" />}
              >
                Talk to Expert
              </LoadingButton>
            )}

            {/* Enhanced TTS Controls */}
            {displayContent && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <LanguageSelector
                    value={selectedLanguage}
                    onValueChange={setSelectedLanguage}
                    placeholder="Select language for audio"
                  />

                  <LoadingButton
                    variant="secondary"
                    onClick={() => {
                      console.log('[DEBUG] Generate Audio clicked');
                      console.log('[DEBUG] displayContent:', displayContent);
                      console.log('[DEBUG] selectedLanguage:', selectedLanguage);
                      generateAudio(displayContent, selectedLanguage);
                    }}
                    loading={isGeneratingAudio || streamingTTS.isLoading}
                    disabled={streamingTTS.isStreaming}
                  >
                    <Languages className="mr-2 h-4 w-4" />
                    {isGeneratingAudio || streamingTTS.isLoading ? "Generating..." :
                      streamingTTS.isStreaming ? "Streaming..." : "Generate Audio"}
                  </LoadingButton>

                  {/* Debug button - remove after testing */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const completeText = getCompleteStoryText();
                      console.log('=== DEBUG STORY CONTENT ===');
                      console.log('Story type:', story.storyType);
                      console.log('Story content:', story.content);
                      console.log('Story content length:', story.content?.length || 0);
                      console.log('Complete text:', completeText);
                      console.log('Complete text length:', completeText.length);
                      console.log('Display content:', displayContent);
                      console.log('Display content length:', displayContent?.length || 0);
                      alert(`Story content length: ${story.content?.length || 0}\nComplete text length: ${completeText.length}\nDisplay content length: ${displayContent?.length || 0}`);
                    }}
                  >
                    Debug Content
                  </Button>

                  {streamingTTS.isStreaming && (
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-600">
                        Progress: {Math.round(streamingTTS.progress)}%
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={streamingTTS.stopStreaming}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Debug Info */}
                <div className="text-xs text-gray-500 mt-2">
                  Debug: audioChunks={streamingTTS.audioChunks.length}, audioData={audioData ? 'exists' : 'none'},
                  isStreaming={streamingTTS.isStreaming ? 'yes' : 'no'},
                  error={streamingTTS.error || 'none'}
                </div>

                {/* Sequential Audio Player for Streaming */}
                {streamingTTS.audioChunks.length > 0 && (
                  <div>
                    <div className="text-sm text-blue-600 mb-2">
                      Using Sequential Player with {streamingTTS.audioChunks.length} chunks
                    </div>
                    <SequentialAudioPlayer
                      audioChunks={streamingTTS.audioChunks}
                      onPlaybackComplete={() => {
                        console.log('[DEBUG] Sequential player completed');
                      }}
                      onError={(error) => {
                        console.error('[DEBUG] Sequential player error:', error);
                      }}
                      className="mt-2"
                    />
                  </div>
                )}

                {/* Fallback Audio Player for single audio data */}
                {audioData && streamingTTS.audioChunks.length === 0 && (
                  <div>
                    <div className="text-sm text-orange-600 mb-2">
                      Using Fallback Player (single audio data)
                    </div>
                    <AudioPlayer
                      audioData={audioData}
                      onPlay={() => {
                        console.log('[DEBUG] Fallback player started');
                        // Track listen event when audio starts playing
                        if (story.status === "published") {
                          fetch(`/api/stories/${story.id}/analytics`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              eventType: 'listen',
                              languageCode: selectedLanguage
                            })
                          }).catch(console.error);
                        }
                      }}
                      className="mt-2"
                    />
                  </div>
                )}

                {streamingTTS.error && (
                  <div className="text-red-600 text-sm">
                    Error: {streamingTTS.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <Separator className="mb-8" />

        {/* Story Content */}
        <div className="prose dark:prose-invert max-w-none mb-12 locale-content indic-text">
          {story.storyType === 'blog_story' ? (
            // Blog story content
            story.content ? (
              <div
                className="text-lg leading-relaxed locale-content"
                dangerouslySetInnerHTML={{ __html: story.content }}
              />
            ) : (
              <p className="text-muted-foreground italic">No content available.</p>
            )
          ) : (
            // Life story content with tabs
            story.summary ? (
              <Tabs defaultValue="narrative" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="narrative">Your Narrative</TabsTrigger>
                  <TabsTrigger value="steps">Your Path Forward</TabsTrigger>
                </TabsList>
                <TabsContent value="narrative" className="pt-6">
                  {story.summary.longFormStory ? (
                    <Tabs defaultValue="user-summary" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="user-summary">Summary View</TabsTrigger>
                        <TabsTrigger value="long-form">Full Story</TabsTrigger>
                      </TabsList>
                      <TabsContent value="user-summary">
                        <div className="whitespace-pre-wrap text-lg leading-relaxed">
                          {story.summary.userSummary}
                        </div>
                      </TabsContent>
                      <TabsContent value="long-form">
                        <div className="whitespace-pre-wrap text-lg leading-relaxed">
                          {story.summary.longFormStory}
                        </div>
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="whitespace-pre-wrap text-lg leading-relaxed">
                      {story.summary.userSummary}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="steps" className="pt-6">
                  <ul className="list-disc pl-6 space-y-3">
                    {(story.summary.actionableSteps || []).map((step, i) => (
                      <li key={i} className="whitespace-pre-wrap text-muted-foreground text-lg leading-relaxed">
                        {typeof step === "string" ? step : JSON.stringify(step)}
                      </li>
                    ))}
                  </ul>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-muted-foreground italic">Story content is being generated...</p>
            )
          )}
        </div>

        {/* Comments Section - Only show for published stories */}
        {story.status === "published" && (
          <section className="mt-12">
            <Separator className="mb-8" />
            <CommentsSection
              storyId={story.id}
              storyOwnerId={story.owner.clerkId}
            />
          </section>
        )}

        {/* Related Stories */}
        {relatedStories && relatedStories.length > 0 && (
          <section className="mt-16">
            <Separator className="mb-8" />
            <h2 className="text-2xl font-bold mb-6">Related Stories</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      <Card className="h-full flex flex-col hover:border-primary transition-colors duration-200 group">
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
          </div>
          <CardTitle className="text-base leading-tight line-clamp-2">
            {story.title}
          </CardTitle>
          <CardDescription className="flex items-center gap-1 text-sm">
            <User className="h-3 w-3" />
            {story.authorName}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-grow pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {story.viewCount}
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