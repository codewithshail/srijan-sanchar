"use client";

import { useQuery } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { storyStatusEnum, storyVisibilityEnum } from "@/lib/schema";

type Story = {
  id: string;
  title: string | null;
  status: typeof storyStatusEnum.enumValues[number];
  visibility: typeof storyVisibilityEnum.enumValues[number];
  createdAt: string;
  owner: { clerkId: string };
};

async function fetchAllStories(): Promise<Story[]> {
  const res = await fetch("/api/admin/stories");
  if (!res.ok) throw new Error("Failed to fetch stories");
  return res.json();
}

export const StoriesTable = () => {
  const { data: stories, isLoading } = useQuery({
    queryKey: ["admin-all-stories"],
    queryFn: fetchAllStories,
  });

  const columns: ColumnDef<Story>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => row.original.title ?? "Untitled Story"
    },
    {
      accessorKey: "owner.clerkId",
      header: "Owner Clerk ID",
    },
     {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={row.original.status === 'completed' ? 'default' : 'secondary'}>{row.original.status}</Badge>
    },
    {
      accessorKey: "visibility",
      header: "Visibility",
      cell: ({ row }) => <Badge variant={row.original.visibility !== 'private' ? 'destructive' : 'outline'}>{row.original.visibility}</Badge>
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
              Created At <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
      ),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: "actions",
      cell: ({ row }) => (
          <Link href={`/story/${row.original.id}`} target="_blank">
             <Button variant="ghost" size="sm">
                View <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
      ),
    },
  ];

  return <DataTable columns={columns} data={stories ?? []} isLoading={isLoading} />;
};