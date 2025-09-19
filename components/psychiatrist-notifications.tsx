"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Link from "next/link";

type AppointmentRequest = {
  id: string;
  storyId: string;
  createdAt: string;
  user: { firstName: string | null; lastName: string | null };
  story: { title: string | null };
};

export function PsychiatristNotifications() {
  const { data: appointments } = useQuery<AppointmentRequest[]>({
    queryKey: ["psychiatrist-appointments"],
    queryFn: async () => {
      const res = await fetch("/api/psychiatrist/appointments");
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const pendingCount = appointments?.length || 0;

  if (pendingCount === 0) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {pendingCount}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h4 className="font-semibold">Pending Consultation Requests</h4>
          {appointments?.slice(0, 3).map((appointment) => (
            <div key={appointment.id} className="text-sm space-y-1">
              <div className="font-medium">
                {appointment.story.title || "Untitled Story"}
              </div>
              <div className="text-muted-foreground">
                From: {appointment.user.firstName || "Anonymous"}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(appointment.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
          {pendingCount > 3 && (
            <div className="text-sm text-muted-foreground">
              +{pendingCount - 3} more requests
            </div>
          )}
          <Link href="/psychiatrist" className="block">
            <Button size="sm" className="w-full">
              View All Requests
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}