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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare } from "lucide-react";

interface AppointmentFeedbackDialogProps {
  appointmentId: string;
  currentFeedback?: string;
  currentNotes?: string;
  currentStatus?: string;
}

export function AppointmentFeedbackDialog({
  appointmentId,
  currentFeedback = "",
  currentNotes = "",
  currentStatus = "confirmed",
}: AppointmentFeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(currentFeedback);
  const [notes, setNotes] = useState(currentNotes);
  const [status, setStatus] = useState(currentStatus);
  const queryClient = useQueryClient();

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/psychiatrist/appointments/${appointmentId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, notes, status }),
      });
      if (!res.ok) throw new Error("Failed to save feedback");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Feedback saved successfully");
      queryClient.invalidateQueries({ queryKey: ["psychiatrist-confirmed-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["userAppointments"] });
      setOpen(false);
    },
    onError: () => {
      toast.error("Failed to save feedback");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    feedbackMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          {currentFeedback ? "Edit Feedback" : "Add Feedback"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Session Feedback & Notes</DialogTitle>
            <DialogDescription>
              Add your professional feedback and notes for this consultation session.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status">Session Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Session Notes</Label>
              <Textarea
                id="notes"
                placeholder="Private notes about the session (not shared with patient)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Patient Feedback</Label>
              <Textarea
                id="feedback"
                placeholder="Feedback and recommendations to share with the patient"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <LoadingButton type="submit" loading={feedbackMutation.isPending}>
              Save Feedback
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}