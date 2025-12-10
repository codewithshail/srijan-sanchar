"use client";

import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

interface LikeButtonProps {
  storyId: string;
  className?: string;
  showCount?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  onLikeChange?: (hasLiked: boolean, count: number) => void;
}

interface LikeData {
  count: number;
  hasLiked: boolean;
}

export function LikeButton({
  storyId,
  className,
  showCount = true,
  size = "default",
  variant = "outline",
  onLikeChange,
}: LikeButtonProps) {
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const { data: likeData, isLoading } = useQuery<LikeData>({
    queryKey: ["likes", storyId],
    queryFn: async () => {
      const res = await fetch(`/api/stories/${storyId}/likes`);
      if (!res.ok) throw new Error("Failed to fetch likes");
      return res.json();
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Optimistic update helper
  const updateLikeData = useCallback((newData: LikeData) => {
    queryClient.setQueryData(["likes", storyId], newData);
    onLikeChange?.(newData.hasLiked, newData.count);
  }, [queryClient, storyId, onLikeChange]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/stories/${storyId}/likes`, {
        method: "POST",
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in to like stories");
        if (res.status === 409) throw new Error("Already liked");
        throw new Error("Failed to like story");
      }
      return res.json();
    },
    // Optimistic update - immediately update UI before server responds
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["likes", storyId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<LikeData>(["likes", storyId]);
      
      // Optimistically update to the new value
      if (previousData) {
        const optimisticData = {
          count: previousData.count + 1,
          hasLiked: true,
        };
        queryClient.setQueryData(["likes", storyId], optimisticData);
      }
      
      return { previousData };
    },
    onSuccess: (data) => {
      updateLikeData(data);
    },
    onError: (error: Error, _, context) => {
      // Rollback to previous value on error
      if (context?.previousData) {
        queryClient.setQueryData(["likes", storyId], context.previousData);
      }
      toast.error(error.message);
    },
  });

  const unlikeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/stories/${storyId}/likes`, {
        method: "DELETE",
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in");
        throw new Error("Failed to unlike story");
      }
      return res.json();
    },
    // Optimistic update - immediately update UI before server responds
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["likes", storyId] });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData<LikeData>(["likes", storyId]);
      
      // Optimistically update to the new value
      if (previousData) {
        const optimisticData = {
          count: Math.max(0, previousData.count - 1),
          hasLiked: false,
        };
        queryClient.setQueryData(["likes", storyId], optimisticData);
      }
      
      return { previousData };
    },
    onSuccess: (data) => {
      updateLikeData(data);
    },
    onError: (error: Error, _, context) => {
      // Rollback to previous value on error
      if (context?.previousData) {
        queryClient.setQueryData(["likes", storyId], context.previousData);
      }
      toast.error(error.message);
    },
  });

  const handleClick = () => {
    if (!isSignedIn) {
      toast.error("Please sign in to like stories");
      return;
    }

    if (likeData?.hasLiked) {
      unlikeMutation.mutate();
    } else {
      likeMutation.mutate();
    }
  };

  const isLiked = likeData?.hasLiked ?? false;
  const count = likeData?.count ?? 0;
  const isPending = likeMutation.isPending || unlikeMutation.isPending;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isPending || isLoading}
      className={cn(
        "gap-2 transition-all duration-200",
        isLiked && "text-red-500 hover:text-red-600",
        className
      )}
      aria-label={isLiked ? "Unlike this story" : "Like this story"}
      aria-pressed={isLiked}
    >
      <Heart
        className={cn(
          "h-4 w-4 transition-all duration-200",
          isLiked && "fill-current scale-110",
          isPending && "animate-pulse"
        )}
      />
      {showCount && (
        <span className="tabular-nums transition-all duration-200">
          {count}
        </span>
      )}
    </Button>
  );
}
