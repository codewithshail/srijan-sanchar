"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Image as ImageIcon, Loader2, Volume2 } from "lucide-react";
import Image from 'next/image';

// Define types for the story data
type StoryImage = { url: string; prompt: string };
type StorySummary = { userSummary: string; psySummary: string; actionableSteps: string[] };
type StoryData = {
    id: string;
    title: string | null;
    image: StoryImage | null;
    summary: StorySummary | null;
    status: 'draft' | 'completed';
};

export default function StoryPage({ params }: { params: { storyId: string } }) {
    const { data: story, isLoading, error } = useQuery<StoryData>({
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
    });

    if (isLoading) return <div className="container py-8 text-center">Loading your story...</div>;
    if (error) return <div className="container py-8 text-center text-destructive">{error.message}</div>;
    if (!story) return <div className="container py-8 text-center">No story data available.</div>;

    if (story.status === 'draft') {
        return (
            <div className="container py-12 text-center">
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
                <h1 className="text-2xl font-bold">Your story is being woven...</h1>
                <p className="text-muted-foreground">Please wait a moment while we generate your summaries and insights.</p>
            </div>
        )
    }

    return (
        <div className="container max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <header className="text-center">
                <h1 className="text-4xl font-bold tracking-tight">{story.title ?? 'Your Life Story'}</h1>
                <p className="mt-2 text-lg text-muted-foreground">A summary of your journey and steps for the future.</p>
            </header>

            {story.image && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5"/> Your Story&apos;s Image</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="aspect-video relative w-full overflow-hidden rounded-lg border">
                             <Image src={story.image.url} alt={story.image.prompt} fill style={{ objectFit: "cover" }} />
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 italic">Prompt: &quot;{story.image.prompt}&quot;</p>
                    </CardContent>
                </Card>
            )}

            <Tabs defaultValue="userSummary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="userSummary">Your Summary</TabsTrigger>
                    <TabsTrigger value="actionableSteps">Change Your Life</TabsTrigger>
                </TabsList>
                <TabsContent value="userSummary">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Narrative</CardTitle>
                            <CardDescription>This is the beautiful summary of the path you&apos;ve walked.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="whitespace-pre-wrap leading-relaxed">{story.summary?.userSummary}</p>
                            <Button variant="outline"><Volume2 className="mr-2 h-4 w-4"/> Listen (Hindi)</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="actionableSteps">
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Path Forward</CardTitle>
                            <CardDescription>Actionable steps to help you rewrite your future narrative.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                {story.summary?.actionableSteps.map((step, i) => (
                                    <li key={i} className="flex items-start">
                                        <CheckCircle className="h-5 w-5 text-green-500 mt-1 mr-3 flex-shrink-0" />
                                        <span>{step}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}