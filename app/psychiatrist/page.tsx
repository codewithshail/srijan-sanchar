"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type StoryForPsychiatrist = {
  id: string;
  title: string | null;
  summarySnippet: string;
};

export default function PsychiatristDashboardPage() {
    const { data: stories, isLoading } = useQuery<StoryForPsychiatrist[]>({
        queryKey: ['psychiatrist-stories'],
        queryFn: async () => {
            const res = await fetch('/api/psychiatrist/stories');
            if (!res.ok) throw new Error("Failed to fetch stories");
            return res.json();
        }
    });

    return (
        <div className="container py-8">
            <header className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">Psychiatrist Dashboard</h1>
                <p className="mt-2 text-muted-foreground">Review shared narratives for clinical insights and patterns.</p>
            </header>

            {isLoading && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => <StorySkeleton key={i} />)}
                </div>
            )}
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {stories?.map(story => (
                    <Link href={`/psychiatrist/story/${story.id}`} key={story.id}>
                        <Card className="h-full flex flex-col hover:border-primary transition-colors duration-200">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5"/>{story.title ?? "Case Study"}</CardTitle>
                                <CardDescription>Click to view full analysis</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <p className="text-sm text-muted-foreground italic">&quot;{story.summarySnippet}&quot;</p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
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