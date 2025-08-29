"use client";

import { Button } from "@/components/ui/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Loader2,
  BookOpen,
  ShieldCheck,
  Share2,
  Languages,
  Calendar,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Define types for the story data
type StoryImage = { url: string; prompt: string };
type StorySummary = {
  userSummary: string;
  psySummary: string;
  actionableSteps: string[];
  longFormStory?: string;
};
type StoryData = {
  id: string;
  title: string | null;
  image: StoryImage | null;
  summary: StorySummary | null;
  status: "draft" | "completed";
  visibility: "private" | "public_summary" | "public_long";
};

export default function StoryPage({ params }: { params: { storyId: string } }) {
  const queryClient = useQueryClient();
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const {
    data: story,
    isLoading,
    error,
  } = useQuery<StoryData>({
    queryKey: ["story", params.storyId],
    queryFn: async () => {
      const res = await fetch(`/api/stories/${params.storyId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Story not found");
        throw new Error("Failed to fetch story");
      }
      return res.json();
    },
    retry: 1,
    refetchInterval: (query) =>
      query.state.data?.status === "draft" ? 3000 : false,
  });

  const publishMutation = useMutation({
    mutationFn: async ({
      visibility,
    }: {
      visibility: "public_summary" | "public_long";
    }) => {
      const res = await fetch(`/api/stories/${params.storyId}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) throw new Error("Failed to publish story.");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Your story has been published!");
      queryClient.invalidateQueries({ queryKey: ["story", params.storyId] });
    },
    onError: (error) => toast.error(error.message),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: params.storyId }),
      });
      if (!res.ok) {
        if (res.status === 409)
          throw new Error(
            "An appointment request already exists for this story."
          );
        throw new Error("Failed to schedule session.");
      }
      return res.json();
    },
    onSuccess: () =>
      toast.success(
        "Request sent! An expert will review your story and you will be notified."
      ),
    onError: (error) => toast.error(error.message),
  });

  const handleListen = async (language: string) => {
    setIsAudioLoading(true);
    try {
      const res = await fetch("/api/translate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: story?.summary?.userSummary, language }),
      });
      if (!res.ok) throw new Error("Failed to generate audio.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      toast.error("Could not play audio. Please try again.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  if (isLoading)
    return (
      <div className="container py-8 text-center">Loading your story...</div>
    );
  if (error)
    return (
      <div className="container py-8 text-center text-destructive">
        {error.message}
      </div>
    );
  if (!story)
    return (
      <div className="container py-8 text-center">No story data available.</div>
    );

  if (story.status === "draft") {
    return (
      <div className="container py-12 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
        <h1 className="text-2xl font-bold">Your story is being woven...</h1>
        <p className="text-muted-foreground max-w-md">
          This can take a minute. We are generating your summaries, insights,
          and image. Please stay on this page.
        </p>
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto py-8 sm:py-12 px-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {story.title ?? "Your Life Story"}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A narrative of your journey and powerful steps for the future.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          {story.visibility === "private" ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-yellow-500" /> Private
            </span>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <BookOpen className="h-4 w-4 text-green-500" /> Public
            </span>
          )}
        </div>
      </header>

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
            Inspired by: &quot;{story.image.prompt}&quot;
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center mb-12">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>
              <Share2 className="mr-2 h-4 w-4" /> Publish Story
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Make Your Story Public?</AlertDialogTitle>
              <AlertDialogDescription>
                Sharing your story can inspire others. You can choose to share
                just the summary or the full story if you generated one. This
                action can be reversed later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              {story.summary?.longFormStory && (
                <AlertDialogAction
                  onClick={() =>
                    publishMutation.mutate({ visibility: "public_long" })
                  }
                >
                  Publish Full Story
                </AlertDialogAction>
              )}
              <AlertDialogAction
                onClick={() =>
                  publishMutation.mutate({ visibility: "public_summary" })
                }
              >
                Publish Summary
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant="outline" onClick={() => scheduleMutation.mutate()}>
          <Calendar className="mr-2 h-4 w-4" /> Schedule Session with Expert
        </Button>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary">Your Narrative</TabsTrigger>
          <TabsTrigger value="steps">Your Path Forward</TabsTrigger>
        </TabsList>
        <TabsContent value="summary">
          <div className="prose dark:prose-invert max-w-none py-6">
            {story.summary?.longFormStory ? (
              <Tabs defaultValue="user-summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="user-summary">Summary View</TabsTrigger>
                  <TabsTrigger value="long-form">Full Story</TabsTrigger>
                </TabsList>
                <TabsContent value="user-summary">
                  <p className="whitespace-pre-wrap">
                    {story.summary?.userSummary}
                  </p>
                </TabsContent>
                <TabsContent value="long-form">
                  <div className="whitespace-pre-wrap">
                    {story.summary?.longFormStory}
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <p className="whitespace-pre-wrap">
                {story.summary?.userSummary}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isAudioLoading}>
                {isAudioLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="mr-2 h-4 w-4" />
                )}
                Listen to Summary
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleListen("English")}>
                English
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleListen("Hindi")}>
                Hindi
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleListen("Spanish")}>
                Spanish
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleListen("French")}>
                French
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TabsContent>
        <TabsContent value="steps">
          <div className="bg-muted/30 p-6 rounded-lg mt-6">
            <h3 className="text-xl font-bold mb-4">Your Actionable Steps</h3>
            <ul className="space-y-4">
              {story.summary?.actionableSteps.map((step, i) => (
                <li key={i} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-3 flex-shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </article>
  );
}
