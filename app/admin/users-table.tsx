"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table"; // We need to create this generic component
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import { Button, LoadingButton } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { UserRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

type User = {
  id: string;
  clerkId: string;
  role: UserRole;
  createdAt: string;
};

async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/admin/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

async function updateUserRole({ userId, role }: { userId: string; role: UserRole }) {
  const res = await fetch(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.message || "Failed to update role");
  }
  return res.json();
}

export const UsersTable = () => {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
  });

  const mutation = useMutation({
    mutationFn: updateUserRole,
    onSuccess: () => {
      toast.success("User role updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "clerkId",
      header: "Clerk ID",
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.role;
        const variant: "default" | "secondary" | "destructive" = 
            role === 'admin' ? 'destructive' : role === 'psychiatrist' ? 'secondary' : 'default';
        return <Badge variant={variant}>{role}</Badge>
      }
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
              Joined At <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
      ),
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original;
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
              <DropdownMenuItem onClick={() => mutation.mutate({ userId: user.id, role: 'user' })}>Make User</DropdownMenuItem>
              <DropdownMenuItem onClick={() => mutation.mutate({ userId: user.id, role: 'psychiatrist' })}>Make Psychiatrist</DropdownMenuItem>
              <DropdownMenuItem onClick={() => mutation.mutate({ userId: user.id, role: 'admin' })}>Make Admin</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={users ?? []} isLoading={isLoading} />;
};