"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MoreHorizontal,
  PlusCircle,
  Trash2,
  Edit3,
  EyeOff,
  BarChart3,
  Eye,
  Headphones,
  Calendar,
  BookOpen,
  MessageSquare,
  Heart,
  Package,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { PrintOrderDialog } from "@/components/print-order-dialog";
import { UserOrderHistory } from "@/components/user-order-history";

type Story = {
  id: string;
  title: string | null;
  status: "draft" | "completed" | "published";
  updatedAt: string;
  visibility?: "private" | "public_summary" | "public_long";
  storyType?: "life_story" | "blog_story";
  viewCount?: number;
  listenCount?: number;
};

type DashboardStats = {
  totalStories: number;
  totalViews: number;
  totalListens: number;
  totalLikes: number;
  totalComments: number;
  totalPrintOrders: number;
};

type UserAppointment = {
  id: string;
  storyId: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "rejected";
  appointmentDate?: string;
  appointmentTime?: string;
  googleMeetLink?: string;
  notes?: string;
  psychiatristFeedback?: string;
  createdAt: string;
  story: {
    title: string | null;
  };
};

export default function DashboardPage() {
  const qc = useQueryClient();

  const { data: stats, isLoading: isLoadingStats } = useQuery<DashboardStats>({
    queryKey: ["dashboardStats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: stories, isLoading } = useQuery<Story[]>({
    queryKey: ["userStories"],
    queryFn: async () => {
      const res = await fetch("/api/stories");
      if (!res.ok) throw new Error("Failed to fetch stories");
      return res.json();
    },
  });

  const { data: appointments, isLoading: isLoadingAppointments } = useQuery<UserAppointment[]>({
    queryKey: ["userAppointments"],
    queryFn: async () => {
      const res = await fetch("/api/appointments/user");
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetch(`/api/stories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Title updated");
      qc.invalidateQueries({ queryKey: ["userStories"] });
    },
    onError: () => toast.error("Rename failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Story deleted");
      qc.invalidateQueries({ queryKey: ["userStories"] });
    },
    onError: () => toast.error("Could not delete"),
  });

  const unpublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/stories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: "private" }),
      });
      if (!res.ok) throw new Error("Unpublish failed");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Story set to private");
      qc.invalidateQueries({ queryKey: ["userStories"] });
    },
    onError: () => toast.error("Could not unpublish"),
  });

  return (
    <div className="container py-8 pb-24 md:pb-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your stories.
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.totalStories || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.totalViews || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Listens</CardTitle>
            <Headphones className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.totalListens || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.totalLikes || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.totalComments || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Print Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStats ? "..." : stats?.totalPrintOrders || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stories" className="space-y-6">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex min-w-max lg:grid lg:w-auto lg:grid-cols-5">
            <TabsTrigger value="stories">Stories</TabsTrigger>
            <TabsTrigger value="liked">Liked</TabsTrigger>
            <TabsTrigger value="appointments">
              <span className="hidden sm:inline">Expert Sessions</span>
              <span className="sm:hidden">Sessions</span>
            </TabsTrigger>
            <TabsTrigger value="print-orders">
              <span className="hidden sm:inline">Print Orders</span>
              <span className="sm:hidden">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="stories" className="space-y-6">

          {isLoading && <p>Loading your stories...</p>}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stories?.map((story) => (
              <Card
                key={story.id}
                className="h-full hover:border-primary transition-colors"
              >
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>{story.title ?? "Untitled Story"}</CardTitle>
                    <CardDescription className="space-y-1">
                      <div>
                        Status:{" "}
                        <span
                          className={`font-semibold ${story.status === "completed" || story.status === "published"
                              ? "text-green-500"
                              : "text-yellow-500"
                            }`}
                        >
                          {story.status}
                        </span>
                      </div>
                      <div>
                        Type:{" "}
                        <span className="font-semibold text-primary">
                          {story.storyType === "blog_story" ? "Creative Story" : "Life Story"}
                        </span>
                      </div>
                      {story.status === "published" && (
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            <span>{story.viewCount || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Headphones className="h-3 w-3" />
                            <span>{story.listenCount || 0}</span>
                          </div>
                        </div>
                      )}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          const t = prompt("New title:", story.title || "");
                          if (t !== null)
                            renameMutation.mutate({ id: story.id, title: t });
                        }}
                      >
                        <Edit3 className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      {story.status === "published" && (
                        <>
                          <Link href={`/analytics/${story.id}`}>
                            <DropdownMenuItem>
                              <BarChart3 className="mr-2 h-4 w-4" /> View Analytics
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            onClick={() => {
                              const url = `${window.location.origin}/story/${story.id}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Story link copied to clipboard!");
                            }}
                          >
                            <Share2 className="mr-2 h-4 w-4" /> Share Story
                          </DropdownMenuItem>
                        </>
                      )}
                      {(story.status === "completed" || story.status === "published") && (
                        <PrintOrderDialog
                          storyId={story.id}
                          storyTitle={story.title || "Untitled Story"}
                          trigger={
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Package className="mr-2 h-4 w-4" /> Order Print Copy
                            </DropdownMenuItem>
                          }
                        />
                      )}
                      <DropdownMenuItem
                        onClick={() => unpublishMutation.mutate(story.id)}
                      >
                        <EyeOff className="mr-2 h-4 w-4" /> Set Private
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(story.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Last updated: {new Date(story.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      className="w-full"
                      href={
                        story.status === "draft"
                          ? story.storyType === "blog_story"
                            ? `/blog-editor/${story.id}`
                            : `/life-story/${story.id}`
                          : `/story/${story.id}`
                      }
                    >
                      <Button
                        variant={
                          story.status === "completed" || story.status === "published" ? "default" : "secondary"
                        }
                        className="w-full"
                      >
                        {story.status === "completed" || story.status === "published" ? "View" : "Continue"}
                      </Button>
                    </Link>
                    <Link
                      className="w-full"
                      href={
                        story.storyType === "blog_story"
                          ? `/blog-editor/${story.id}`
                          : `/life-story/${story.id}`
                      }
                    >
                      <Button variant="outline" className="w-full">Editor</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!isLoading && stories?.length === 0 && (
              <div className="col-span-full text-center py-12">
                <h2 className="text-2xl font-semibold">No stories yet</h2>
                <p className="text-muted-foreground mt-2">
                  Start a new story to begin your journey.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="liked" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Liked Stories</h2>
              <p className="text-sm text-muted-foreground">Stories you've shown love to</p>
            </div>
            <Link href="/stories/liked">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <div className="text-center py-8">
            <Heart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Visit the <Link href="/stories/liked" className="text-primary hover:underline">Liked Stories</Link> page to see all stories you've liked.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          {isLoadingAppointments && <p>Loading your expert sessions...</p>}

          {!isLoadingAppointments && appointments?.length === 0 && (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold">No Expert Sessions</h2>
              <p className="text-muted-foreground mt-2">
                Complete a life story to request an expert consultation.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {appointments?.map((appointment) => (
              <Card key={appointment.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Expert Session for: {appointment.story.title || "Untitled Story"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Status: <span className={`font-semibold ${appointment.status === "confirmed" ? "text-green-600" :
                            appointment.status === "pending" ? "text-yellow-600" :
                              appointment.status === "completed" ? "text-blue-600" :
                                appointment.status === "rejected" ? "text-red-600" :
                                  "text-gray-600"
                          }`}>
                          {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                        </span>
                      </CardDescription>
                    </div>
                    <Badge variant={
                      appointment.status === "confirmed" ? "default" :
                        appointment.status === "pending" ? "secondary" :
                          appointment.status === "completed" ? "outline" :
                            "destructive"
                    }>
                      {appointment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {appointment.appointmentTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4" />
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

                  {appointment.psychiatristFeedback && (
                    <div className="bg-muted p-3 rounded-lg">
                      <h4 className="font-semibold text-sm mb-2">Expert Feedback:</h4>
                      <p className="text-sm text-muted-foreground">
                        {appointment.psychiatristFeedback}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Requested: {new Date(appointment.createdAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="print-orders" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Print Orders</h2>
              <p className="text-sm text-muted-foreground">Track your print-on-demand orders</p>
            </div>
            <Link href="/orders">
              <Button variant="outline" size="sm">
                View All Orders
              </Button>
            </Link>
          </div>
          <UserOrderHistory />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard />
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      <Link href="/create">
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg md:h-auto md:w-auto md:rounded-md md:px-4"
          title="Create New Story"
        >
          <PlusCircle className="h-6 w-6 md:h-4 md:w-4 md:mr-2" />
          <span className="hidden md:inline">New Story</span>
        </Button>
      </Link>
    </div>
  );
}
