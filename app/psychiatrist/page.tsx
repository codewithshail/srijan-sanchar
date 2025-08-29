"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, Clock, Check, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type StoryForPsychiatrist = {
  id: string;
  title: string | null;
  summarySnippet: string;
};

type AppointmentRequest = {
    id: string;
    storyId: string;
    createdAt: string;
    user: { clerkId: string };
    story: { title: string | null };
}

export default function PsychiatristDashboardPage() {
    const queryClient = useQueryClient();

    const { data: stories, isLoading: isLoadingStories } = useQuery<StoryForPsychiatrist[]>({
        queryKey: ['psychiatrist-stories'],
        queryFn: async () => {
            const res = await fetch('/api/psychiatrist/stories');
            if (!res.ok) throw new Error("Failed to fetch stories");
            return res.json();
        }
    });
    
    const { data: appointments, isLoading: isLoadingAppointments } = useQuery<AppointmentRequest[]>({
        queryKey: ['psychiatrist-appointments'],
        queryFn: async () => {
            const res = await fetch('/api/psychiatrist/appointments');
            if (!res.ok) throw new Error("Failed to fetch appointments");
            return res.json();
        }
    });

    const acceptMutation = useMutation({
        mutationFn: (appointmentId: string) => {
            return fetch(`/api/psychiatrist/appointments/${appointmentId}/accept`, {
                method: 'PATCH',
            });
        },
        onSuccess: () => {
            toast.success("Appointment confirmed!");
            queryClient.invalidateQueries({ queryKey: ['psychiatrist-appointments'] });
        },
        onError: () => toast.error("Failed to confirm appointment."),
    });

    return (
        <div className="container py-8">
            <header className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">Psychiatrist Dashboard</h1>
                <p className="mt-2 text-muted-foreground">Review shared narratives and manage appointment requests.</p>
            </header>

            <Tabs defaultValue="stories" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="stories">Shared Stories</TabsTrigger>
                    <TabsTrigger value="appointments">Appointment Requests ({appointments?.length ?? 0})</TabsTrigger>
                </TabsList>

                <TabsContent value="stories">
                    {/* ... Story listing code remains the same ... */}
                </TabsContent>

                <TabsContent value="appointments">
                    <div className="mt-6 space-y-4">
                        {isLoadingAppointments && <p>Loading requests...</p>}
                        {!isLoadingAppointments && appointments?.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">No pending appointment requests.</p>
                        )}
                        {appointments?.map(req => (
                            <Card key={req.id}>
                                <CardHeader>
                                    <CardTitle>Request for: {req.story.title ?? "Untitled Story"}</CardTitle>
                                    <CardDescription>From user: {req.user.clerkId}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex justify-between items-center">
                                    <p className="text-sm text-muted-foreground">
                                        Received on: {new Date(req.createdAt).toLocaleDateString()}
                                    </p>
                                    <div className="flex gap-2">
                                        <Link href={`/psychiatrist/story/${req.storyId}`}><Button variant="outline">View Story</Button></Link>
                                        <Button 
                                            onClick={() => acceptMutation.mutate(req.id)}
                                            disabled={acceptMutation.isPending && acceptMutation.variables === req.id}
                                        >
                                            {acceptMutation.isPending && acceptMutation.variables === req.id 
                                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> 
                                                : <Check className="mr-2 h-4 w-4"/>
                                            }
                                            Accept
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
// ... StorySkeleton remains the same ...

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