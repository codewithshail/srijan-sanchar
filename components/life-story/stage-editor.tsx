"use client";

import { useState, useEffect, useCallback } from "react";
import { LIFE_STAGES, getStageById, getStagePrompts, type LifeStageId } from "@/lib/life-stages";
import { Button, LoadingButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, Save, ChevronLeft, ChevronRight, AlertCircle, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AIToolbar, type AIAction } from "./ai-toolbar";
import { AISuggestionsPanel } from "./ai-suggestions-panel";
import { VoiceInput } from "./voice-input";
import { toast } from "sonner";

interface StageEditorProps {
  stageId: LifeStageId;
  content: string;
  isFromTemplate: boolean;
  onContentChange: (content: string) => void;
  onSave: () => Promise<void>;
  onNavigate: (direction: "prev" | "next") => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
}

export function StageEditor({
  stageId,
  content,
  isFromTemplate,
  onContentChange,
  onSave,
  onNavigate,
  isSaving,
  hasUnsavedChanges,
}: StageEditorProps) {
  const stage = getStageById(stageId);
  const prompts = getStagePrompts(stageId);
  const [showPrompts, setShowPrompts] = useState(false);

  // AI features state
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [currentAIAction, setCurrentAIAction] = useState<AIAction | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);

  // Voice input language preference (persisted in localStorage)
  const [voiceLanguage, setVoiceLanguage] = useState<string>("en-IN");

  const stageIndex = LIFE_STAGES.findIndex((s) => s.id === stageId);
  const hasPrev = stageIndex > 0;
  const hasNext = stageIndex < LIFE_STAGES.length - 1;

  // Load voice language preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("voice-input-language");
      if (savedLanguage) {
        setVoiceLanguage(savedLanguage);
      }
    }
  }, []);

  // Clear AI state when stage changes
  useEffect(() => {
    setAIError(null);
    setSuggestions(null);
    setShowSuggestions(false);
    setPreviousContent(null);
  }, [stageId]);

  // Handle voice input transcript
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      // Append transcript to existing content with proper spacing
      const newContent = content
        ? `${content}${content.endsWith(" ") ? "" : " "}${transcript}`
        : transcript;
      onContentChange(newContent);
      toast.success("Voice input added");
    },
    [content, onContentChange]
  );

  // AI action handler
  const handleAIAction = useCallback(
    async (action: AIAction, options?: { targetLanguage?: string; tone?: string }) => {
      if (!content.trim()) {
        toast.error("Please add some content first");
        return;
      }

      setIsAIProcessing(true);
      setCurrentAIAction(action);
      setAIError(null);

      try {
        const response = await fetch("/api/ai/life-story-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: content,
            action,
            targetLanguage: options?.targetLanguage,
            tone: options?.tone,
            stageName: stage?.name,
            context: stage?.description,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "AI assistance failed");
        }

        const data = await response.json();

        if (action === "suggest") {
          setSuggestions(data.result);
          setShowSuggestions(true);
          toast.success("Suggestions generated!");
        } else {
          // Save previous content for undo
          setPreviousContent(content);
          onContentChange(data.result);

          const actionLabels: Record<AIAction, string> = {
            rewrite: "Content rewritten",
            grammar: "Grammar improved",
            expand: "Content expanded",
            translate: "Content translated",
            suggest: "Suggestions generated",
          };
          toast.success(actionLabels[action]);
        }
      } catch (error: any) {
        console.error("AI action error:", error);
        setAIError(error.message || "AI assistance failed");
        toast.error(error.message || "AI assistance failed");
      } finally {
        setIsAIProcessing(false);
        setCurrentAIAction(null);
      }
    },
    [content, stage, onContentChange]
  );

  // Undo AI changes
  const handleUndo = useCallback(() => {
    if (previousContent !== null) {
      onContentChange(previousContent);
      setPreviousContent(null);
      toast.success("Changes undone");
    }
  }, [previousContent, onContentChange]);

  // Refresh suggestions
  const handleRefreshSuggestions = useCallback(() => {
    handleAIAction("suggest");
  }, [handleAIAction]);

  if (!stage) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Stage Header */}
      <div className="p-6 border-b bg-background">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{stage.icon}</span>
              <div>
                <h2 className="text-2xl font-bold">{stage.name}</h2>
                <p className="text-muted-foreground">
                  {stage.nativeName} ({stage.transliteration})
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{stage.description}</p>
          </div>
          {isFromTemplate && (
            <Badge variant="secondary" className="flex-shrink-0">
              Pre-filled from template
            </Badge>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* AI Error Alert */}
          {aiError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{aiError}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAIError(null)}
                  className="h-6 px-2"
                >
                  Dismiss
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* AI Suggestions Panel */}
          {showSuggestions && (
            <AISuggestionsPanel
              suggestions={suggestions}
              isLoading={isAIProcessing && currentAIAction === "suggest"}
              onRefresh={handleRefreshSuggestions}
              onClose={() => setShowSuggestions(false)}
            />
          )}

          {/* Writing Prompts */}
          <Card className={cn("transition-all", showPrompts ? "border-primary/30" : "")}>
            <CardHeader
              className="cursor-pointer py-3"
              onClick={() => setShowPrompts(!showPrompts)}
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm font-medium">
                  Need inspiration? Click for writing prompts
                </CardTitle>
              </div>
            </CardHeader>
            {showPrompts && (
              <CardContent className="pt-0">
                <CardDescription className="mb-2">
                  Consider these questions as you write:
                </CardDescription>
                <ul className="space-y-2">
                  {prompts.map((prompt, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-primary">•</span>
                      {prompt}
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>

          {/* AI Toolbar */}
          <div className="flex items-center justify-between gap-2 py-2 px-1 border rounded-lg bg-muted/30">
            <AIToolbar
              onAction={handleAIAction}
              disabled={isSaving}
              isProcessing={isAIProcessing}
              currentAction={currentAIAction}
              hasContent={content.trim().length > 0}
            />
            <div className="flex items-center gap-2">
              {previousContent !== null && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleUndo}
                  className="h-8 gap-1 text-muted-foreground"
                >
                  <Undo2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Undo AI</span>
                </Button>
              )}
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                disabled={isSaving || isAIProcessing}
                defaultLanguage={voiceLanguage}
                compact
              />
            </div>
          </div>

          {/* Text Editor */}
          <div className="relative">
            <Textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={`Share your memories and experiences from your ${stage.name.toLowerCase()}...`}
              className="min-h-[300px] resize-none text-base leading-relaxed locale-content indic-text"
              disabled={isAIProcessing}
            />
            {isAIProcessing && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="animate-pulse">Processing with AI...</span>
                </div>
              </div>
            )}
          </div>

          {/* Character Count & Status */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {content.length} characters
              {content.length > 0 && ` • ~${Math.ceil(content.split(/\s+/).filter(Boolean).length / 200)} min read`}
            </span>
            <div className="flex items-center gap-3">
              {previousContent !== null && (
                <span className="text-blue-600 dark:text-blue-400">
                  AI changes applied
                </span>
              )}
              {hasUnsavedChanges && (
                <span className="text-yellow-600 dark:text-yellow-400">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t bg-muted/30">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => onNavigate("prev")}
            disabled={!hasPrev}
            className="gap-1"
            size="sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous Stage</span>
            <span className="sm:hidden">Prev</span>
          </Button>

          <LoadingButton
            onClick={onSave}
            loading={isSaving}
            disabled={!hasUnsavedChanges}
            icon={<Save className="h-4 w-4" />}
            size="sm"
          >
            <span className="hidden sm:inline">Save Stage</span>
            <span className="sm:hidden">Save</span>
          </LoadingButton>

          <Button
            variant="ghost"
            onClick={() => onNavigate("next")}
            disabled={!hasNext}
            className="gap-1"
            size="sm"
          >
            <span className="hidden sm:inline">Next Stage</span>
            <span className="sm:hidden">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StageEditor;
