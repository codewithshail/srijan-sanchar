"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StoryForPsychiatrist = {
  id: string;
  title: string | null;
  summarySnippet: string;
};

// You'd expand this with actual data
type AppointmentRequest = {
  id: string;
  storyId: string;
  user: { email: string }; // You would fetch more user details
  createdAt: string;
};

export default function PsychiatristDashboardPage() {
  const { data: stories, isLoading: isLoadingStories } = useQuery<
    StoryForPsychiatrist[]
  >({
    queryKey: ["psychiatrist-stories"],
    queryFn: async () => {
      const res = await fetch("/api/psychiatrist/stories");
      if (!res.ok) throw new Error("Failed to fetch stories");
      return res.json();
    },
  });

  // Placeholder for appointments API call
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<
    AppointmentRequest[]
  >({
    queryKey: ["psychiatrist-appointments"],
    queryFn: async () => {
      // This API route needs to be created
      // const res = await fetch('/api/psychiatrist/appointments');
      // if (!res.ok) throw new Error("Failed to fetch appointments");
      // return res.json();
      return []; // Returning empty array for now
    },
  });

  return (
    <div className="container py-8">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Psychiatrist Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review shared narratives and manage appointment requests.
        </p>
      </header>

      <Tabs defaultValue="stories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stories">Shared Stories</TabsTrigger>
          <TabsTrigger value="appointments">Appointment Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="stories">
          {isLoadingStories && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <StorySkeleton key={i} />
              ))}
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
            {stories?.map((story) => (
              <Link href={`/psychiatrist/story/${story.id}`} key={story.id}>
                <Card className="h-full flex flex-col hover:border-primary transition-colors duration-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {story.title ?? "Case Study"}
                    </CardTitle>
                    <CardDescription>
                      Click to view full analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground italic">
                      &quot;{story.summarySnippet}&quot;
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <div className="mt-6">
            {isLoadingAppointments && <p>Loading requests...</p>}
            {!isLoadingAppointments && appointments?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No pending appointment requests.
              </p>
            )}
            {/* Here you would map over appointments and display them */}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
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
