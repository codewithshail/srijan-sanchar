"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { ArrowUpDown, ExternalLink, Eye, Check, X, MoreHorizontal } from "lucide-react";
import { Button, LoadingButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from "next/link";
import { storyStatusEnum, storyVisibilityEnum, storyTypeEnum } from "@/lib/db/schema";
import { toast } from "sonner";
import { useState } from "react";

type Story = {
  id: string;
  title: string | null;
  storyType: (typeof storyTypeEnum.enumValues)[number];
  content: string | null;
  status: (typeof storyStatusEnum.enumValues)[number];
  visibility: (typeof storyVisibilityEnum.enumValues)[number];
  publishedAt: string | null;
  viewCount: number;
  listenCount: number;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    clerkId: string;
  };
  summary?: {
    userSummary: string;
    longFormStory: string | null;
  } | null;
};

async function fetchAllStories(): Promise<Story[]> {
  const res = await fetch("/api/admin/stories");
  if (!res.ok) throw new Error("Failed to fetch stories");
  return res.json();
}

async function updateStoryStatus(storyId: string, status: string) {
  const res = await fetch(`/api/admin/stories/${storyId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to update story status");
  }
  return res.json();
}

export const StoriesTable = () => {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const queryClient = useQueryClient();
  
  const { data: stories, isLoading } = useQuery({
    queryKey: ["admin-all-stories"],
    queryFn: fetchAllStories,
  });

  const statusMutation = useMutation({
    mutationFn: ({ storyId, status }: { storyId: string; status: string }) =>
      updateStoryStatus(storyId, status),
    onSuccess: () => {
      toast.success("Story status updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-all-stories"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "published":
        return "default";
      case "pending_review":
        return "secondary";
      case "rejected":
        return "destructive";
      case "completed":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStoryTypeBadgeVariant = (type: string) => {
    return type === "blog_story" ? "secondary" : "outline";
  };

  const columns: ColumnDef<Story>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="max-w-[200px] truncate">
          {row.original.title ?? "Untitled Story"}
        </div>
      ),
    },
    {
      accessorKey: "storyType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={getStoryTypeBadgeVariant(row.original.storyType)}>
          {row.original.storyType === "blog_story" ? "Blog" : "Life Story"}
        </Badge>
      ),
    },
    {
      accessorKey: "owner",
      header: "Author",
      cell: ({ row }) => {
        const { firstName, lastName } = row.original.owner;
        return (
          <div className="max-w-[150px] truncate">
            {`${firstName || ""} ${lastName || ""}`.trim() || "Anonymous"}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={getStatusBadgeVariant(row.original.status)}>
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "visibility",
      header: "Visibility",
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.visibility !== "private" ? "destructive" : "outline"
          }
        >
          {row.original.visibility.replace("_", " ")}
        </Badge>
      ),
    },
    {
      accessorKey: "engagement",
      header: "Engagement",
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {row.original.viewCount} views • {row.original.listenCount} listens
        </div>
      ),
    },
    {
      accessorKey: "publishedAt",
      header: "Published",
      cell: ({ row }) => 
        row.original.publishedAt 
          ? new Date(row.original.publishedAt).toLocaleDateString()
          : "—",
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const story = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSelectedStory(story)}>
                <Eye className="mr-2 h-4 w-4" />
                View Content
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/story/${story.id}`} target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Story
                </Link>
              </DropdownMenuItem>
              {story.status === "pending_review" && (
                <>
                  <DropdownMenuItem
                    onClick={() =>
                      statusMutation.mutate({ storyId: story.id, status: "published" })
                    }
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve & Publish
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      statusMutation.mutate({ storyId: story.id, status: "rejected" })
                    }
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </DropdownMenuItem>
                </>
              )}
              {story.status === "published" && (
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({ storyId: story.id, status: "rejected" })
                  }
                >
                  <X className="mr-2 h-4 w-4" />
                  Unpublish
                </DropdownMenuItem>
              )}
              {story.status === "rejected" && (
                <DropdownMenuItem
                  onClick={() =>
                    statusMutation.mutate({ storyId: story.id, status: "published" })
                  }
                >
                  <Check className="mr-2 h-4 w-4" />
                  Publish
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <>
      <DataTable columns={columns} data={stories ?? []} isLoading={isLoading} />
      
      {/* Story Content Modal */}
      <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedStory?.title || "Untitled Story"} - Content Review
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
            {selectedStory && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>Author:</strong> {selectedStory.owner.firstName} {selectedStory.owner.lastName}
                  </div>
                  <div>
                    <strong>Type:</strong> {selectedStory.storyType === "blog_story" ? "Blog Story" : "Life Story"}
                  </div>
                  <div>
                    <strong>Status:</strong> {selectedStory.status.replace("_", " ")}
                  </div>
                  <div>
                    <strong>Created:</strong> {new Date(selectedStory.createdAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-2">Content:</h4>
                  {selectedStory.storyType === "blog_story" ? (
                    <div className="prose max-w-none">
                      {selectedStory.content ? (
                        <div dangerouslySetInnerHTML={{ __html: selectedStory.content }} />
                      ) : (
                        <p className="text-muted-foreground">No content available</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedStory.summary?.userSummary && (
                        <div>
                          <h5 className="font-medium mb-1">User Summary:</h5>
                          <p className="text-sm">{selectedStory.summary.userSummary}</p>
                        </div>
                      )}
                      {selectedStory.summary?.longFormStory && (
                        <div>
                          <h5 className="font-medium mb-1">Long Form Story:</h5>
                          <p className="text-sm whitespace-pre-wrap">{selectedStory.summary.longFormStory}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {selectedStory.status === "pending_review" && (
                  <div className="border-t pt-4 flex gap-2">
                    <LoadingButton
                      onClick={() => {
                        statusMutation.mutate({ storyId: selectedStory.id, status: "published" });
                        setSelectedStory(null);
                      }}
                      loading={statusMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve & Publish
                    </LoadingButton>
                    <LoadingButton
                      onClick={() => {
                        statusMutation.mutate({ storyId: selectedStory.id, status: "rejected" });
                        setSelectedStory(null);
                      }}
                      loading={statusMutation.isPending}
                      variant="destructive"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </LoadingButton>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};
