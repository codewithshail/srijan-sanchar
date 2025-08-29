"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type PublicStory = {
  id: string;
  title: string | null;
  summarySnippet: string;
  visibility: 'public_summary' | 'public_long';
};

export default function PublicStoriesPage() {
    const { data: stories, isLoading } = useQuery<PublicStory[]>({
        queryKey: ['publicStories'],
        queryFn: async () => {
            const res = await fetch('/api/stories/public');
            if (!res.ok) throw new Error("Failed to fetch public stories");
            return res.json();
        }
    });

    return (
        <div className="container py-8">
            <header className="text-center mb-10">
                <h1 className="text-4xl font-bold tracking-tight">Explore Public Stories</h1>
                <p className="mt-2 text-lg text-muted-foreground">Discover the narratives and journeys shared by our community.</p>
            </header>

            {isLoading && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => <StorySkeleton key={i} />)}
                </div>
            )}
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stories?.map(story => (
                    <Link href={`/story/${story.id}`} key={story.id}>
                        <Card className="h-full flex flex-col hover:border-primary transition-colors duration-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5"/>{story.title ?? "An Untitled Journey"}</CardTitle>
                                <CardDescription>A shared story</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground">{story.summarySnippet}</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

             {!isLoading && stories?.length === 0 && (
                <div className="text-center py-12 col-span-full">
                    <h2 className="text-2xl font-semibold">The Library is Quiet</h2>
                    <p className="text-muted-foreground mt-2">No public stories have been shared yet. Be the first!</p>
                </div>
             )}
        </div>
    )
}

function StorySkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/4 mt-2" />
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
            </CardContent>
        </Card>
    );
}