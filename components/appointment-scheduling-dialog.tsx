"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, LoadingButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MessageSquare } from "lucide-react";

interface AppointmentSchedulingDialogProps {
  appointmentId: string;
  currentDate?: string;
  currentTime?: string;
  currentNotes?: string;
  mode: 'schedule' | 'reschedule';
}

export function AppointmentSchedulingDialog({
  appointmentId,
  currentDate = "",
  currentTime = "",
  currentNotes = "",
  mode,
}: AppointmentSchedulingDialogProps) {
  const [open, setOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState(currentDate);
  const [appointmentTime, setAppointmentTime] = useState(currentTime);
  const [notes, setNotes] = useState(currentNotes);
  const queryClient = useQueryClient();

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/psychiatrist/appointments/${appointmentId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          appointmentDate: `${appointmentDate}T${appointmentTime}`,
          notes 
        }),
      });
      if (!res.ok) throw new Error("Failed to schedule appointment");
      return res.json();
    },
    onSuccess: () => {
      toast.success(mode === 'schedule' ? "Appointment scheduled successfully" : "Appointment rescheduled successfully");
      queryClient.invalidateQueries({ queryKey: ["psychiatrist-confirmed-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["psychiatrist-appointments"] });
      setOpen(false);
    },
    onError: () => {
      toast.error("Failed to schedule appointment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentDate || !appointmentTime) {
      toast.error("Please select both date and time");
      return;
    }
    scheduleMutation.mutate();
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Calendar className="h-4 w-4 mr-2" />
          {mode === 'schedule' ? 'Schedule' : 'Reschedule'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {mode === 'schedule' ? 'Schedule Appointment' : 'Reschedule Appointment'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'schedule' 
                ? 'Set the date and time for this consultation session.'
                : 'Update the date and time for this consultation session.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  min={today}
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Session Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about the scheduled session"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            {appointmentDate && appointmentTime && (
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Scheduled for: {new Date(`${appointmentDate}T${appointmentTime}`).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" loading={scheduleMutation.isPending}>
              {mode === 'schedule' ? 'Schedule' : 'Reschedule'}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}