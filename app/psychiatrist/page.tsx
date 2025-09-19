"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileText, Clock, Check, Loader2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, LoadingButton } from "@/components/ui/button";
import { toast } from "sonner";
import { AppointmentFeedbackDialog } from "@/components/appointment-feedback-dialog";

type StoryForPsychiatrist = {
  id: string;
  title: string | null;
  summarySnippet: string;
};

type AppointmentRequest = {
  id: string;
  storyId: string;
  createdAt: string;
  user: { clerkId: string; firstName: string | null; lastName: string | null };
  story: { title: string | null };
};

type ConfirmedAppointment = {
  id: string;
  storyId: string;
  appointmentTime: string | null;
  googleMeetLink: string | null;
  notes: string | null;
  psychiatristFeedback: string | null;
  status: string;
  user: { clerkId: string; firstName: string | null; lastName: string | null };
  story: { title: string | null };
};

export default function PsychiatristDashboardPage() {
  const queryClient = useQueryClient();

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

  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<
    AppointmentRequest[]
  >({
    queryKey: ["psychiatrist-appointments"],
    queryFn: async () => {
      const res = await fetch("/api/psychiatrist/appointments");
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });

  const { data: confirmedAppointments, isLoading: isLoadingConfirmed } = useQuery<
    ConfirmedAppointment[]
  >({
    queryKey: ["psychiatrist-confirmed-appointments"],
    queryFn: async () => {
      const res = await fetch("/api/psychiatrist/appointments/confirmed");
      if (!res.ok) throw new Error("Failed to fetch confirmed appointments");
      return res.json();
    },
  });

  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["psychiatrist-appointments"],
      });
    },
  };

  const acceptMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      fetch(`/api/psychiatrist/appointments/${appointmentId}/accept`, {
        method: "PATCH",
      }),
    ...mutationOptions,
    onSuccess: () => {
      toast.success("Appointment confirmed and email sent!");
      mutationOptions.onSuccess();
    },
    onError: () => toast.error("Failed to confirm appointment."),
  });

  const rejectMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      fetch(`/api/psychiatrist/appointments/${appointmentId}/reject`, {
        method: "PATCH",
      }),
    ...mutationOptions,
    onSuccess: () => {
      toast.success("Appointment rejected.");
      mutationOptions.onSuccess();
    },
    onError: () => toast.error("Failed to reject appointment."),
  });

  const isMutating = acceptMutation.isPending || rejectMutation.isPending;

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

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="appointments">
            Requests ({appointments?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Confirmed Sessions
          </TabsTrigger>
          <TabsTrigger value="stories">Shared Stories</TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="mt-6">
          {isLoadingStories && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <StorySkeleton key={i} />
              ))}
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

        <TabsContent value="confirmed">
          <div className="mt-6 space-y-4">
            {isLoadingConfirmed && <p>Loading confirmed sessions...</p>}
            {!isLoadingConfirmed && confirmedAppointments?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No confirmed sessions yet.
              </p>
            )}
            {confirmedAppointments?.map((appointment) => (
              <Card key={appointment.id}>
                <CardHeader>
                  <CardTitle>
                    Session: {appointment.story.title ?? "Untitled Story"}
                  </CardTitle>
                  <CardDescription>
                    Patient: {appointment.user.firstName || "Anonymous"} (
                    {appointment.user.clerkId.slice(-8)})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {appointment.appointmentTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>
                        Scheduled: {new Date(appointment.appointmentTime).toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {appointment.googleMeetLink && (
                    <div className="flex gap-2">
                      <Button asChild size="sm">
                        <a href={appointment.googleMeetLink} target="_blank" rel="noopener noreferrer">
                          Join Meeting
                        </a>
                      </Button>
                    </div>
                  )}
                  
                  {appointment.notes && (
                    <div className="bg-muted p-3 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Notes:</h4>
                      <p className="text-sm">{appointment.notes}</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between items-center bg-muted/50 py-3 px-6">
                  <div className="flex items-center gap-2">
                    <Link href={`/psychiatrist/story/${appointment.storyId}`} passHref>
                      <Button variant="outline" size="sm">Review Story</Button>
                    </Link>
                    <AppointmentFeedbackDialog
                      appointmentId={appointment.id}
                      currentFeedback={appointment.psychiatristFeedback || ""}
                      currentNotes={appointment.notes || ""}
                      currentStatus={appointment.status}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Status: {appointment.status}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <div className="mt-6 space-y-4">
            {isLoadingAppointments && <p>Loading requests...</p>}
            {!isLoadingAppointments && appointments?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No pending appointment requests.
              </p>
            )}
            {appointments?.map((req) => (
              <Card key={req.id}>
                <CardHeader>
                  <CardTitle>
                    Request for: {req.story.title ?? "Untitled Story"}
                  </CardTitle>
                  <CardDescription>
                    From user: {req.user.firstName || "Anonymous"} (
                    {req.user.clerkId.slice(-8)})
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between items-center bg-muted/50 py-3 px-6">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Received:{" "}
                    {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/psychiatrist/story/${req.storyId}`} passHref>
                      <Button variant="outline">Read Story</Button>
                    </Link>
                    <LoadingButton
                      variant="destructive"
                      onClick={() => rejectMutation.mutate(req.id)}
                      loading={rejectMutation.isPending && rejectMutation.variables === req.id}
                      disabled={isMutating}
                      icon={<XCircle className="h-4 w-4" />}
                    >
                      Reject
                    </LoadingButton>
                    <LoadingButton
                      onClick={() => acceptMutation.mutate(req.id)}
                      loading={acceptMutation.isPending && acceptMutation.variables === req.id}
                      disabled={isMutating}
                      icon={<Check className="h-4 w-4" />}
                    >
                      Accept
                    </LoadingButton>
                  </div>
                </CardFooter>
              </Card>
            ))}
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
