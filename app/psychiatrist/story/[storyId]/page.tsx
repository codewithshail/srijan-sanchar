"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

// Using the same detailed Story type from the main story page
type StoryImage = { url: string; prompt: string };
type StorySummary = { userSummary: string; psySummary: string; actionableSteps: string[] };
type StoryData = {
    id: string;
    title: string | null;
    image: StoryImage | null;
    summary: StorySummary | null;
    status: 'draft' | 'completed';
};

export default function PsychiatristStoryView({ params }: { params: { storyId: string } }) {
    const { data: story, isLoading, error } = useQuery<StoryData>({
        // We can reuse the public story API endpoint since it has all the data we need
        queryKey: ["story", params.storyId],
        queryFn: async () => {
            const res = await fetch(`/api/stories/${params.storyId}`);
            if (!res.ok) throw new Error("Failed to fetch story data");
            return res.json();
        },
    });

    if (isLoading) return <div className="container py-8"><Skeleton className="h-96 w-full" /></div>;
    if (error) return <div className="container py-8 text-destructive">{error.message}</div>;
    if (!story?.summary) return <div className="container py-8">Story summary not available.</div>;

    return (
        <div className="container max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-2">{story.title ?? "Clinical Case Review"}</h1>
            <p className="text-muted-foreground mb-6">Story ID: {story.id}</p>

            <Tabs defaultValue="clinical" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="clinical">Clinical Formulation</TabsTrigger>
                    <TabsTrigger value="narrative">User Narrative</TabsTrigger>
                </TabsList>
                <TabsContent value="clinical">
                    <Card>
                        <CardHeader>
                            <CardTitle>Psychiatric Formulation</CardTitle>
                            <CardDescription>Analysis of themes, strengths, and potential interventions.</CardDescription>
                        </CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none">
                            <p className="whitespace-pre-wrap">{story.summary.psySummary}</p>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="narrative">
                    <Card>
                        <CardHeader>
                            <CardTitle>User&apos;s Story Summary</CardTitle>
                            <CardDescription>The narrative as presented to the user.</CardDescription>
                        </CardHeader>
                        <CardContent className="prose dark:prose-invert max-w-none">
                            <p className="whitespace-pre-wrap">{story.summary.userSummary}</p>
                            <h4 className="font-semibold mt-4">Actionable Steps Provided:</h4>
                            <ul>
                                {story.summary.actionableSteps.map((step, i) => <li key={i}>{step}</li>)}
                            </ul>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}