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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Calendar, FileText, Target, Plus, X } from "lucide-react";

interface AppointmentFeedbackDialogProps {
  appointmentId: string;
  currentFeedback?: string;
  currentNotes?: string;
  currentStatus?: string;
}

interface TreatmentRecommendation {
  id: string;
  category: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface StructuredFeedback {
  sessionSummary: string;
  keyInsights: string;
  patientProgress: string;
  treatmentRecommendations: TreatmentRecommendation[];
  nextSteps: string;
  followUpDate?: string;
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
  const [activeTab, setActiveTab] = useState("basic");
  
  // Structured feedback state
  const [structuredFeedback, setStructuredFeedback] = useState<StructuredFeedback>(() => {
    try {
      return currentFeedback ? JSON.parse(currentFeedback) : {
        sessionSummary: "",
        keyInsights: "",
        patientProgress: "",
        treatmentRecommendations: [],
        nextSteps: "",
        followUpDate: "",
      };
    } catch {
      return {
        sessionSummary: currentFeedback,
        keyInsights: "",
        patientProgress: "",
        treatmentRecommendations: [],
        nextSteps: "",
        followUpDate: "",
      };
    }
  });
  
  const queryClient = useQueryClient();

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      const finalFeedback = activeTab === "structured" 
        ? JSON.stringify(structuredFeedback, null, 2)
        : feedback;
        
      const res = await fetch(`/api/psychiatrist/appointments/${appointmentId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          feedback: finalFeedback, 
          notes, 
          status,
          feedbackType: activeTab 
        }),
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

  const addTreatmentRecommendation = () => {
    setStructuredFeedback(prev => ({
      ...prev,
      treatmentRecommendations: [
        ...prev.treatmentRecommendations,
        {
          id: Date.now().toString(),
          category: "",
          description: "",
          priority: "medium"
        }
      ]
    }));
  };

  const removeTreatmentRecommendation = (id: string) => {
    setStructuredFeedback(prev => ({
      ...prev,
      treatmentRecommendations: prev.treatmentRecommendations.filter(rec => rec.id !== id)
    }));
  };

  const updateTreatmentRecommendation = (id: string, field: keyof TreatmentRecommendation, value: string) => {
    setStructuredFeedback(prev => ({
      ...prev,
      treatmentRecommendations: prev.treatmentRecommendations.map(rec =>
        rec.id === id ? { ...rec, [field]: value } : rec
      )
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          {currentFeedback ? "Edit Feedback" : "Add Feedback"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Session Feedback & Treatment Plan
            </DialogTitle>
            <DialogDescription>
              Provide comprehensive feedback and treatment recommendations for this consultation session.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {/* Session Status */}
            <div className="mb-6">
              <Label htmlFor="status">Session Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rescheduled">Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Basic Feedback
                </TabsTrigger>
                <TabsTrigger value="structured" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Structured Assessment
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Private Session Notes</Label>
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
                    rows={6}
                  />
                </div>
              </TabsContent>

              <TabsContent value="structured" className="space-y-6 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">Private Session Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Private notes about the session (not shared with patient)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Session Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Brief summary of the session and key discussion points"
                      value={structuredFeedback.sessionSummary}
                      onChange={(e) => setStructuredFeedback(prev => ({ ...prev, sessionSummary: e.target.value }))}
                      rows={3}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Key Clinical Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Important clinical observations and insights from the session"
                      value={structuredFeedback.keyInsights}
                      onChange={(e) => setStructuredFeedback(prev => ({ ...prev, keyInsights: e.target.value }))}
                      rows={3}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Patient Progress Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Assessment of patient's progress since last session"
                      value={structuredFeedback.patientProgress}
                      onChange={(e) => setStructuredFeedback(prev => ({ ...prev, patientProgress: e.target.value }))}
                      rows={3}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      Treatment Recommendations
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addTreatmentRecommendation}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Recommendation
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {structuredFeedback.treatmentRecommendations.map((rec) => (
                      <div key={rec.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="grid grid-cols-2 gap-3 flex-1">
                            <div>
                              <Label className="text-sm">Category</Label>
                              <Input
                                placeholder="e.g., Therapy, Medication, Lifestyle"
                                value={rec.category}
                                onChange={(e) => updateTreatmentRecommendation(rec.id, 'category', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Priority</Label>
                              <Select
                                value={rec.priority}
                                onValueChange={(value: 'high' | 'medium' | 'low') => 
                                  updateTreatmentRecommendation(rec.id, 'priority', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTreatmentRecommendation(rec.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div>
                          <Label className="text-sm">Description</Label>
                          <Textarea
                            placeholder="Detailed recommendation description"
                            value={rec.description}
                            onChange={(e) => updateTreatmentRecommendation(rec.id, 'description', e.target.value)}
                            rows={2}
                          />
                        </div>
                      </div>
                    ))}
                    {structuredFeedback.treatmentRecommendations.length === 0 && (
                      <p className="text-muted-foreground text-center py-4">
                        No treatment recommendations added yet
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Next Steps & Follow-up</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Next Steps</Label>
                      <Textarea
                        placeholder="Specific next steps for the patient"
                        value={structuredFeedback.nextSteps}
                        onChange={(e) => setStructuredFeedback(prev => ({ ...prev, nextSteps: e.target.value }))}
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label>Recommended Follow-up Date</Label>
                      <Input
                        type="date"
                        value={structuredFeedback.followUpDate}
                        onChange={(e) => setStructuredFeedback(prev => ({ ...prev, followUpDate: e.target.value }))}
                        className="mt-2"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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