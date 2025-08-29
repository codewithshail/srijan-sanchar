"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Story = {
  id: string;
  title: string | null;
  status: 'draft' | 'completed';
  updatedAt: string;
};

export default function DashboardPage() {
    const router = useRouter();

    const { data: stories, isLoading } = useQuery<Story[]>({
        queryKey: ['userStories'],
        queryFn: async () => {
            const res = await fetch('/api/stories');
            if (!res.ok) throw new Error('Failed to fetch stories');
            return res.json();
        }
    });

    const { mutate: createStory, isPending: isCreating } = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/stories', { method: 'POST' });
            if (!res.ok) throw new Error('Failed to create story');
            return res.json() as Promise<{ id: string }>;
        },
        onSuccess: (data) => {
            toast.success("New story started!");
            router.push(`/wizard/${data.id}`);
        },
        onError: () => toast.error("Could not start a new story.")
    });

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Stories</h1>
        <Button onClick={() => createStory()} disabled={isCreating}>
            <PlusCircle className="mr-2 h-4 w-4"/>
            {isCreating ? 'Starting...' : 'Start New Story'}
        </Button>
      </div>
      
      {isLoading && <p>Loading your stories...</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stories?.map(story => (
          <Link key={story.id} href={story.status === 'draft' ? `/wizard/${story.id}` : `/story/${story.id}`}>
            <Card className="h-full hover:border-primary transition-colors">
              <CardHeader>
                <CardTitle>{story.title ?? `Untitled Story`}</CardTitle>
                <CardDescription>
                  Status: <span className={`font-semibold ${story.status === 'completed' ? 'text-green-500' : 'text-yellow-500'}`}>{story.status}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Last updated: {new Date(story.updatedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
         {!isLoading && stories?.length === 0 && (
            <div className="col-span-full text-center py-12">
                <h2 className="text-2xl font-semibold">No stories yet</h2>
                <p className="text-muted-foreground mt-2">Start a new story to begin your journey.</p>
                <Button onClick={() => createStory()} disabled={isCreating} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Start Your First Story
                </Button>
            </div>
         )}
      </div>
    </div>
  );
}