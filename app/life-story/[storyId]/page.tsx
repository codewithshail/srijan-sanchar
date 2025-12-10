"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Menu, X, Send } from "lucide-react";
import { Button, LoadingButton } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StageNavigator, StageEditor, SubmissionDialog } from "@/components/life-story";
import { LIFE_STAGES, type LifeStageId } from "@/lib/life-stages";
import { cn } from "@/lib/utils";

interface StageData {
  content: string;
  isFromTemplate: boolean;
  audioUrl: string | null;
  updatedAt: Date | null;
}

interface StagesResponse {
  storyId: string;
  stages: Record<string, StageData>;
  completedStages: LifeStageId[];
  totalStages: number;
  completionPercentage: number;
}

export default function LifeStoryEditorPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const storyId = params.storyId as string;

  const [currentStageId, setCurrentStageId] = useState<LifeStageId>("childhood");
  const [localContent, setLocalContent] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<LifeStageId | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Fetch stages data
  const {
    data: stagesData,
    isLoading,
    error,
  } = useQuery<StagesResponse>({
    queryKey: ["storyStages", storyId],
    queryFn: async () => {
      const res = await fetch(`/api/stories/${storyId}/stages`);
      if (!res.ok) throw new Error("Failed to fetch stages");
      return res.json();
    },
    enabled: !!storyId,
  });

  // Initialize local content from fetched data
  useEffect(() => {
    if (stagesData?.stages) {
      const contentMap: Record<string, string> = {};
      for (const [stageId, data] of Object.entries(stagesData.stages)) {
        contentMap[stageId] = data.content;
      }
      setLocalContent(contentMap);
    }
  }, [stagesData]);

  // Save stage mutation
  const saveStageMutation = useMutation({
    mutationFn: async ({
      stageName,
      content,
      saveAsTemplate,
    }: {
      stageName: string;
      content: string;
      saveAsTemplate?: boolean;
    }) => {
      const res = await fetch(`/api/stories/${storyId}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageName, content, saveAsTemplate }),
      });
      if (!res.ok) throw new Error("Failed to save stage");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storyStages", storyId] });
      setHasUnsavedChanges(false);
      toast.success("Stage saved successfully");
    },
    onError: () => {
      toast.error("Failed to save stage");
    },
  });

  // Handle content change
  const handleContentChange = useCallback(
    (content: string) => {
      setLocalContent((prev) => ({
        ...prev,
        [currentStageId]: content,
      }));
      const originalContent = stagesData?.stages[currentStageId]?.content || "";
      setHasUnsavedChanges(content !== originalContent);
    },
    [currentStageId, stagesData]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    const content = localContent[currentStageId] || "";
    await saveStageMutation.mutateAsync({
      stageName: currentStageId,
      content,
      saveAsTemplate: true, // Always save as template for reuse
    });
  }, [currentStageId, localContent, saveStageMutation]);

  // Handle stage navigation
  const handleStageSelect = useCallback(
    (stageId: LifeStageId) => {
      if (hasUnsavedChanges) {
        setPendingNavigation(stageId);
        setShowUnsavedDialog(true);
      } else {
        setCurrentStageId(stageId);
        setMobileNavOpen(false);
      }
    },
    [hasUnsavedChanges]
  );

  // Handle navigation with prev/next buttons
  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      const currentIndex = LIFE_STAGES.findIndex((s) => s.id === currentStageId);
      const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < LIFE_STAGES.length) {
        handleStageSelect(LIFE_STAGES[newIndex].id);
      }
    },
    [currentStageId, handleStageSelect]
  );

  // Handle unsaved changes dialog
  const handleDiscardChanges = useCallback(() => {
    if (pendingNavigation) {
      // Reset local content to original
      const originalContent = stagesData?.stages[currentStageId]?.content || "";
      setLocalContent((prev) => ({
        ...prev,
        [currentStageId]: originalContent,
      }));
      setHasUnsavedChanges(false);
      setCurrentStageId(pendingNavigation);
      setPendingNavigation(null);
      setMobileNavOpen(false);
    }
    setShowUnsavedDialog(false);
  }, [pendingNavigation, currentStageId, stagesData]);

  const handleSaveAndNavigate = useCallback(async () => {
    await handleSave();
    if (pendingNavigation) {
      setCurrentStageId(pendingNavigation);
      setPendingNavigation(null);
      setMobileNavOpen(false);
    }
    setShowUnsavedDialog(false);
  }, [handleSave, pendingNavigation]);

  // Handle submit story
  const handleSubmitStory = useCallback(() => {
    setShowSubmitDialog(true);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">Failed to load story stages</p>
        <Button onClick={() => router.push("/dashboard")}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const currentStageData = stagesData?.stages[currentStageId];
  const completedStages = stagesData?.completedStages || [];

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-80 border-r flex-col bg-muted/30">
        <StageNavigator
          currentStageId={currentStageId}
          completedStages={completedStages}
          onStageSelect={handleStageSelect}
          savingStage={saveStageMutation.isPending ? currentStageId : null}
        />
        <div className="p-4 border-t">
          <LoadingButton
            className="w-full"
            onClick={handleSubmitStory}
            disabled={completedStages.length === 0}
            icon={<Send className="h-4 w-4" />}
          >
            Submit Story
          </LoadingButton>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-40 bg-background border-b p-2 flex items-center justify-between">
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Menu className="h-4 w-4" />
              Stages
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-0">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold">Life Stages</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <StageNavigator
                currentStageId={currentStageId}
                completedStages={completedStages}
                onStageSelect={handleStageSelect}
                savingStage={saveStageMutation.isPending ? currentStageId : null}
                className="flex-1"
              />
              <div className="p-4 border-t">
                <LoadingButton
                  className="w-full"
                  onClick={handleSubmitStory}
                  disabled={completedStages.length === 0}
                  icon={<Send className="h-4 w-4" />}
                >
                  Submit Story
                </LoadingButton>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-medium">
          {LIFE_STAGES.find((s) => s.id === currentStageId)?.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {completedStages.length}/{LIFE_STAGES.length}
        </span>
      </div>

      {/* Main Editor Area */}
      <main className={cn("flex-1 flex flex-col", "lg:pt-0 pt-14")}>
        <StageEditor
          stageId={currentStageId}
          content={localContent[currentStageId] || ""}
          isFromTemplate={currentStageData?.isFromTemplate || false}
          onContentChange={handleContentChange}
          onSave={handleSave}
          onNavigate={handleNavigate}
          isSaving={saveStageMutation.isPending}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      </main>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in this stage. Would you like to save them
              before navigating away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscardChanges}>
              Discard Changes
            </Button>
            <LoadingButton
              onClick={handleSaveAndNavigate}
              loading={saveStageMutation.isPending}
            >
              Save & Continue
            </LoadingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Submit Story Dialog */}
      <SubmissionDialog
        storyId={storyId}
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
      />
    </div>
  );
}
