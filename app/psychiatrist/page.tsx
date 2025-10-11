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
import { 
  FileText, 
  Clock, 
  Check, 
  XCircle, 
  Calendar,
  User,
  MessageSquare,
  AlertCircle,
  TrendingUp,
  Search,
  Eye,
  BookOpen
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, LoadingButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AppointmentFeedbackDialog } from "@/components/appointment-feedback-dialog";
import { AppointmentSchedulingDialog } from "@/components/appointment-scheduling-dialog";
import { useState } from "react";

type StoryForPsychiatrist = {
  id: string;
  title: string | null;
  summarySnippet: string;
  storyType: 'life_story' | 'blog_story';
  status: string;
  createdAt: string;
  owner: { firstName: string | null; lastName: string | null; clerkId: string };
  viewCount: number;
  listenCount: number;
};

type AppointmentRequest = {
  id: string;
  storyId: string;
  createdAt: string;
  user: { clerkId: string; firstName: string | null; lastName: string | null };
  story: { title: string | null; storyType: 'life_story' | 'blog_story' };
};

type ConfirmedAppointment = {
  id: string;
  storyId: string;
  appointmentTime: string | null;
  appointmentDate: string | null;
  googleMeetLink: string | null;
  notes: string | null;
  psychiatristFeedback: string | null;
  status: string;
  user: { clerkId: string; firstName: string | null; lastName: string | null };
  story: { title: string | null; storyType: 'life_story' | 'blog_story' };
};

type DashboardStats = {
  totalStories: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  completedSessions: number;
};

export default function PsychiatristDashboardPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [storyTypeFilter, setStoryTypeFilter] = useState<string>("all");

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

  const { data: dashboardStats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["psychiatrist-dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/psychiatrist/dashboard-stats");
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
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

  // Filter stories based on search and filters
  const filteredStories = stories?.filter((story) => {
    const matchesSearch = !searchTerm || 
      story.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${story.owner.firstName} ${story.owner.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || story.status === statusFilter;
    const matchesType = storyTypeFilter === "all" || story.storyType === storyTypeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  return (
    <div className="container py-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">
          Psychiatrist Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Comprehensive patient care and story analysis platform
        </p>
      </header>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? <Skeleton className="h-8 w-16" /> : dashboardStats?.totalStories || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? <Skeleton className="h-8 w-16" /> : dashboardStats?.pendingAppointments || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confirmed Sessions</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? <Skeleton className="h-8 w-16" /> : dashboardStats?.confirmedAppointments || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Sessions</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? <Skeleton className="h-8 w-16" /> : dashboardStats?.completedSessions || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="appointments" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Requests ({appointments?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Sessions ({confirmedAppointments?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="stories" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Stories ({filteredStories.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stories" className="mt-6 space-y-6">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stories or patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
              </SelectContent>
            </Select>
            <Select value={storyTypeFilter} onValueChange={setStoryTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="life_story">Life Stories</SelectItem>
                <SelectItem value="blog_story">Blog Stories</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoadingStories && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <StorySkeleton key={i} />
              ))}
            </div>
          )}
          
          {!isLoadingStories && filteredStories.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No stories found</h3>
              <p className="text-muted-foreground">
                {searchTerm || statusFilter !== "all" || storyTypeFilter !== "all" 
                  ? "Try adjusting your search or filters" 
                  : "No stories have been shared for review yet"}
              </p>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredStories.map((story) => (
              <Link href={`/psychiatrist/story/${story.id}`} key={story.id}>
                <Card className="h-full flex flex-col hover:border-primary transition-colors duration-200 group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="flex items-center gap-2 group-hover:text-primary transition-colors">
                        <FileText className="h-5 w-5" />
                        {story.title ?? "Untitled Story"}
                      </CardTitle>
                      <Badge variant={story.storyType === 'life_story' ? 'default' : 'secondary'}>
                        {story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {`${story.owner.firstName || ''} ${story.owner.lastName || ''}`.trim() || 'Anonymous'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-3">
                    <p className="text-sm text-muted-foreground italic line-clamp-3">
                      &quot;{story.summarySnippet}&quot;
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {story.viewCount}
                        </span>
                        <span>Status: {story.status}</span>
                      </div>
                      <span>{new Date(story.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Eye className="h-4 w-4 mr-2" />
                      Review Story
                    </Button>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="confirmed">
          <div className="mt-6 space-y-4">
            {isLoadingConfirmed && (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {!isLoadingConfirmed && confirmedAppointments?.length === 0 && (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No confirmed sessions</h3>
                <p className="text-muted-foreground">
                  Confirmed appointments will appear here
                </p>
              </div>
            )}
            
            {confirmedAppointments?.map((appointment) => (
              <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {appointment.story.title ?? "Untitled Story"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4" />
                        {appointment.user.firstName || "Anonymous"} ({appointment.user.clerkId.slice(-8)})
                      </CardDescription>
                    </div>
                    <Badge 
                      variant={
                        appointment.status === 'completed' ? 'default' : 
                        appointment.status === 'confirmed' ? 'secondary' : 'outline'
                      }
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {appointment.appointmentTime && (
                      <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">Scheduled:</span>
                        <span>{new Date(appointment.appointmentTime).toLocaleString()}</span>
                      </div>
                    )}
                    
                    {appointment.appointmentDate && appointment.appointmentDate !== appointment.appointmentTime && (
                      <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                        <Calendar className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Date:</span>
                        <span>{new Date(appointment.appointmentDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {appointment.googleMeetLink && (
                      <div className="flex items-center gap-2">
                        <Button asChild size="sm" className="flex-1">
                          <a href={appointment.googleMeetLink} target="_blank" rel="noopener noreferrer">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Join Meeting
                          </a>
                        </Button>
                      </div>
                    )}
                    
                    {appointment.notes && (
                      <div className="bg-muted p-3 rounded-lg">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Session Notes:
                        </h4>
                        <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
                      </div>
                    )}
                    
                    {appointment.psychiatristFeedback && (
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                          <MessageSquare className="h-4 w-4" />
                          Patient Feedback:
                        </h4>
                        <p className="text-sm whitespace-pre-wrap text-blue-600 dark:text-blue-200">
                          {appointment.psychiatristFeedback}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 py-4 px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/psychiatrist/story/${appointment.storyId}`} passHref>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Review Story
                      </Button>
                    </Link>
                    <AppointmentSchedulingDialog
                      appointmentId={appointment.id}
                      currentDate={appointment.appointmentDate ? new Date(appointment.appointmentDate).toISOString().split('T')[0] : ""}
                      currentTime={appointment.appointmentDate ? new Date(appointment.appointmentDate).toTimeString().slice(0, 5) : ""}
                      currentNotes={appointment.notes || ""}
                      mode={appointment.appointmentDate ? 'reschedule' : 'schedule'}
                    />
                    <AppointmentFeedbackDialog
                      appointmentId={appointment.id}
                      currentFeedback={appointment.psychiatristFeedback || ""}
                      currentNotes={appointment.notes || ""}
                      currentStatus={appointment.status}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Story Type: {appointment.story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <div className="mt-6 space-y-4">
            {isLoadingAppointments && (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardFooter>
                      <Skeleton className="h-10 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
            
            {!isLoadingAppointments && appointments?.length === 0 && (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
                <p className="text-muted-foreground">
                  New appointment requests will appear here
                </p>
              </div>
            )}
            
            {appointments?.map((req) => (
              <Card key={req.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        {req.story.title ?? "Untitled Story"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4" />
                        {req.user.firstName || "Anonymous"} ({req.user.clerkId.slice(-8)})
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {req.story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">Received:</span>
                    <span>{new Date(req.createdAt).toLocaleString()}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/30 py-4 px-6">
                  <div className="text-xs text-muted-foreground">
                    Patient is requesting expert consultation for their story
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Link href={`/psychiatrist/story/${req.storyId}`} passHref className="flex-1 sm:flex-none">
                      <Button variant="outline" size="sm" className="w-full">
                        <Eye className="h-4 w-4 mr-2" />
                        Review Story
                      </Button>
                    </Link>
                    <LoadingButton
                      variant="destructive"
                      size="sm"
                      onClick={() => rejectMutation.mutate(req.id)}
                      loading={rejectMutation.isPending && rejectMutation.variables === req.id}
                      disabled={isMutating}
                      icon={<XCircle className="h-4 w-4" />}
                    >
                      Reject
                    </LoadingButton>
                    <LoadingButton
                      size="sm"
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
