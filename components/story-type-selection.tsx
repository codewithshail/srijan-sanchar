"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/button";
import { BookOpen, PenTool, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";

interface StoryTypeSelectionProps {
  onSelect?: (type: 'life_story' | 'blog_story') => void;
}

export default function StoryTypeSelection({ onSelect }: StoryTypeSelectionProps) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'life_story' | 'blog_story' | null>(null);

  const createStoryMutation = useMutation({
    mutationFn: async (storyType: 'life_story' | 'blog_story') => {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyType }),
      });
      if (!res.ok) throw new Error("Failed to create story");
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: async (data, storyType) => {
      // Mark onboarding as complete
      await fetch("/api/user/complete-onboarding", {
        method: "POST",
      });

      toast.success("New story started");
      if (storyType === 'life_story') {
        router.push(`/life-story/${data.id}`);
      } else {
        router.push(`/blog-editor/${data.id}`);
      }
    },
    onError: () => toast.error("Could not start a new story"),
  });

  const handleSelect = (type: 'life_story' | 'blog_story') => {
    setSelectedType(type);
    if (onSelect) {
      onSelect(type);
    } else {
      createStoryMutation.mutate(type);
    }
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Choose Your Story Type</h1>
        <p className="text-muted-foreground text-lg">
          Select the format that best suits your storytelling needs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Life Story Card */}
        <Card
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50 ${selectedType === 'life_story' ? 'border-primary shadow-lg' : ''
            }`}
          onClick={() => handleSelect('life_story')}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Write Your Own Life Story</CardTitle>
            <CardDescription className="text-base">
              Guided 7-stage journey for personal transformation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Perfect for:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Self-reflection and personal growth</li>
                <li>• Structured life narrative exploration</li>
                <li>• Therapeutic storytelling with AI guidance</li>
                <li>• Professional consultation opportunities</li>
              </ul>
            </div>
            <div className="pt-2">
              <LoadingButton
                className="w-full"
                loading={createStoryMutation.isPending && selectedType === 'life_story'}
                loadingText="Starting..."
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect('life_story');
                }}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Start Life Story Journey
              </LoadingButton>
            </div>
          </CardContent>
        </Card>

        {/* Blog Story Card */}
        <Card
          className={`cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50 ${selectedType === 'blog_story' ? 'border-primary shadow-lg' : ''
            }`}
          onClick={() => handleSelect('blog_story')}
        >
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
              <PenTool className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Write a Story</CardTitle>
            <CardDescription className="text-base">
              Free-form creative writing with Srijan Sanchar assistance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Perfect for:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Creative storytelling and fiction</li>
                <li>• Personal experiences and memories</li>
                <li>• Srijan Sanchar-enhanced content generation</li>
                <li>• Public sharing and discovery</li>
              </ul>
            </div>
            <div className="pt-2">
              <LoadingButton
                className="w-full"
                loading={createStoryMutation.isPending && selectedType === 'blog_story'}
                loadingText="Starting..."
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect('blog_story');
                }}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Start Creative Writing
              </LoadingButton>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-muted-foreground">
          You can always switch between formats or create multiple stories of different types
        </p>
      </div>
    </div>
  );
}