"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, LoadingButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Eye,
  Loader2,
  Clock,
  FileText,
  Sparkles,
  AlertCircle,
  Undo2,
  X,
  Send,
} from "lucide-react";
import RichTextEditor from "@/components/editor/rich-text-editor";
import { CreativeAIToolbar, type AIAction } from "@/components/creative-story";
import { VoiceInput } from "@/components/life-story/voice-input";
import { StoryGenerationConfigDialog } from "@/components/story-generation-config-dialog";
import { toast } from "sonner";

interface BlogStory {
  id: string;
  title: string;
  content: string;
  description: string;
  storyType: string;
  status: string;
  updatedAt: string;
}

export default function BlogEditorPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const [story, setStory] = useState<BlogStory | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [isImprovingTitle, setIsImprovingTitle] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // AI features state
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [currentAIAction, setCurrentAIAction] = useState<AIAction | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);

  // Voice input language preference
  const [voiceLanguage, setVoiceLanguage] = useState<string>("en-IN");

  // Auto-save state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generation dialog state
  const [showGenerationDialog, setShowGenerationDialog] = useState(false);

  // Load voice language preference from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("voice-input-language");
      if (savedLanguage) {
        setVoiceLanguage(savedLanguage);
      }
    }
  }, []);

  // Load story data
  useEffect(() => {
    const loadStory = async () => {
      if (!storyId) return;

      try {
        setIsLoading(true);
        const res = await fetch(`/api/stories/${storyId}/content`);

        if (!res.ok) {
          throw new Error("Failed to load story");
        }

        const storyData: BlogStory = await res.json();

        if (storyData.storyType !== "blog_story") {
          toast.error("This editor is only for blog stories");
          router.push(`/editor/${storyId}`);
          return;
        }

        setStory(storyData);
        setTitle(storyData.title || "");
        setContent(storyData.content || "");
        setDescription(storyData.description || "");
      } catch (error) {
        console.error("Error loading story:", error);
        toast.error("Failed to load story");
        router.push("/dashboard");
      } finally {
        setIsLoading(false);
      }
    };

    loadStory();
  }, [storyId, router]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save content function
  const handleAutoSave = useCallback(async (newContent: string) => {
    if (!storyId) return;

    try {
      const res = await fetch(`/api/stories/${storyId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent }),
      });

      if (!res.ok) {
        throw new Error("Failed to save content");
      }

      const updatedStory = await res.json();
      setStory(prev => prev ? { ...prev, ...updatedStory } : null);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save failed:", error);
      throw error;
    }
  }, [storyId]);

  // Save title function
  const saveTitle = async () => {
    if (!title.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    try {
      setIsSavingTitle(true);
      const res = await fetch(`/api/stories/${storyId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to save title");
      }

      const updatedStory = await res.json();
      setStory(prev => prev ? { ...prev, ...updatedStory } : null);
      toast.success("Title saved successfully");
    } catch (error) {
      console.error("Error saving title:", error);
      toast.error("Error saving title");
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Save description function
  const saveDescription = async () => {
    try {
      setIsSavingDescription(true);
      const res = await fetch(`/api/stories/${storyId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to save description");
      }

      const updatedStory = await res.json();
      setStory(prev => prev ? { ...prev, ...updatedStory } : null);
      toast.success("Description saved successfully");
    } catch (error) {
      console.error("Error saving description:", error);
      toast.error("Error saving description");
    } finally {
      setIsSavingDescription(false);
    }
  };

  // Improve or generate title with AI
  const improveTitle = useCallback(async () => {
    // Check if we have either a title or content to work with
    if (!title.trim() && !content.trim()) {
      toast.error("Please add a title or content first");
      return;
    }

    try {
      setIsImprovingTitle(true);

      // Determine what action to take
      const hasExistingTitle = title.trim().length > 0;
      const hasContent = content.trim().length > 50;

      let actionType: string;
      let textToProcess: string;

      if (hasExistingTitle) {
        // Improve existing title
        actionType = "improve_title";
        textToProcess = title;
      } else if (hasContent) {
        // Generate from content
        actionType = "generate_title_from_content";
        textToProcess = content;
      } else {
        toast.error("Please add some content to generate a title");
        return;
      }

      const res = await fetch("/api/ai/creative-story-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToProcess,
          action: actionType,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to improve title");
      }

      const data = await res.json();
      setTitle(data.result);
      toast.success(hasExistingTitle ? "Title improved!" : "Title generated!");
    } catch (error) {
      console.error("Error improving title:", error);
      toast.error("Failed to improve title");
    } finally {
      setIsImprovingTitle(false);
    }
  }, [title, content]);

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  // Generate or improve description dynamically
  const generateDescription = useCallback(async () => {
    // Check if we have either a title or content to work with
    if (!title.trim() && !content.trim()) {
      toast.error("Please add a title or content first");
      return;
    }

    try {
      setIsGeneratingDescription(true);

      // Determine what action to take and what text to send
      const hasExistingDescription = description.trim().length > 0;
      const hasContent = content.trim().length > 50;

      let actionType: string;
      let textToProcess: string;

      if (hasExistingDescription) {
        // Improve existing description
        actionType = "improve_description";
        textToProcess = description;
      } else if (hasContent) {
        // Generate from content
        actionType = "generate_description";
        textToProcess = content;
      } else {
        // Generate from title only
        actionType = "generate_description_from_title";
        textToProcess = title;
      }

      const res = await fetch("/api/ai/creative-story-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToProcess,
          action: actionType,
          storyTitle: title,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate description");
      }

      const data = await res.json();
      setDescription(data.result);
      toast.success(hasExistingDescription ? "Description improved!" : "Description generated!");
    } catch (error) {
      console.error("Error generating description:", error);
      toast.error("Failed to generate description");
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [content, title, description]);

  // Handle voice input transcript
  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      // For rich text editor, we need to append to the HTML content
      const newContent = content
        ? `${content}<p>${transcript}</p>`
        : `<p>${transcript}</p>`;
      setContent(newContent);
      toast.success("Voice input added");

      // Trigger auto-save
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        handleAutoSave(newContent);
      }, 2000);
    },
    [content, handleAutoSave]
  );

  // AI action handler
  const handleAIAction = useCallback(
    async (action: AIAction, options?: { targetLanguage?: string; tone?: string }) => {
      // Get plain text from HTML content
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const plainText = tempDiv.textContent || tempDiv.innerText || '';

      if (!plainText.trim()) {
        toast.error("Please add some content first");
        return;
      }

      setIsAIProcessing(true);
      setCurrentAIAction(action);
      setAIError(null);

      try {
        const response = await fetch("/api/ai/creative-story-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: plainText,
            action,
            targetLanguage: options?.targetLanguage,
            tone: options?.tone,
            storyTitle: title,
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
          // Wrap result in paragraph tags for rich text editor
          const newContent = `<p>${data.result.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
          setContent(newContent);

          const actionLabels: Record<AIAction, string> = {
            rewrite: "Content rewritten",
            grammar: "Grammar improved",
            expand: "Content expanded",
            translate: "Content translated",
            suggest: "Suggestions generated",
          };
          toast.success(actionLabels[action]);

          // Auto-save the AI-modified content
          handleAutoSave(newContent);
        }
      } catch (error: unknown) {
        console.error("AI action error:", error);
        const errorMessage = error instanceof Error ? error.message : "AI assistance failed";
        setAIError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsAIProcessing(false);
        setCurrentAIAction(null);
      }
    },
    [content, title, handleAutoSave]
  );

  // Undo AI changes
  const handleUndo = useCallback(() => {
    if (previousContent !== null) {
      setContent(previousContent);
      setPreviousContent(null);
      toast.success("Changes undone");
      handleAutoSave(previousContent);
    }
  }, [previousContent, handleAutoSave]);

  // Navigate to preview
  const handlePreview = () => {
    if (!title.trim()) {
      toast.error("Please add a title first");
      return;
    }
    router.push(`/story/${storyId}`);
  };

  // Calculate word count
  const getWordCount = useCallback((html: string) => {
    if (!html) return 0;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }, []);

  const wordCount = getWordCount(content);
  const readingTime = Math.ceil(wordCount / 200);

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!story) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Story Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The story you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to edit it.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={!title.trim()} size="sm">
            <Eye className="sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Preview Story</span>
          </Button>
          <Button
            onClick={() => setShowGenerationDialog(true)}
            disabled={!title.trim() || !content.trim()}
            size="sm"
          >
            <Send className="sm:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Generate Story</span>
          </Button>
        </div>
      </div>

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
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* AI Suggestions Panel */}
      {showSuggestions && suggestions && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Suggestions
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuggestions(false)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap">{suggestions}</div>
          </CardContent>
        </Card>
      )}

      {/* Title Editor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Story Title</CardTitle>
            <LoadingButton
              variant="outline"
              size="sm"
              onClick={improveTitle}
              loading={isImprovingTitle}
              loadingText={title.trim() ? "Improving..." : "Generating..."}
              disabled={!title.trim() && !content.trim()}
              icon={<Sparkles className="h-4 w-4" />}
            >
              {title.trim() ? "Improve" : "Generate"}
            </LoadingButton>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Input
              placeholder="Enter your story title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTitle();
                }
              }}
            />
            <LoadingButton
              onClick={saveTitle}
              loading={isSavingTitle}
              loadingText="Saving..."
              disabled={!title.trim()}
              className="shrink-0"
            >
              <span className="hidden sm:inline">Save Title</span>
              <span className="sm:hidden">Save</span>
            </LoadingButton>
          </div>
        </CardContent>
      </Card>

      {/* Auto-generated Description */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Story Description</CardTitle>
              <CardDescription>
                Auto-generated from your content for sharing and discovery
              </CardDescription>
            </div>
            <LoadingButton
              variant="outline"
              size="sm"
              onClick={generateDescription}
              loading={isGeneratingDescription}
              loadingText={description.trim() ? "Improving..." : "Generating..."}
              disabled={!title.trim() && !content.trim()}
              icon={<Sparkles className="h-4 w-4" />}
            >
              {description.trim() ? "Improve" : "Generate"}
            </LoadingButton>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Textarea
              placeholder="Click 'Generate' to create a description from your story content..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <div className="flex justify-end">
              <LoadingButton
                onClick={saveDescription}
                loading={isSavingDescription}
                loadingText="Saving..."
                disabled={!description.trim()}
                size="sm"
              >
                <span className="hidden sm:inline">Save Description</span>
                <span className="sm:hidden">Save</span>
              </LoadingButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats and AI Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {wordCount} words
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {readingTime} min read
          </Badge>
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {formatLastSaved(lastSaved)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <CreativeAIToolbar
            onAction={handleAIAction}
            disabled={isAIProcessing}
            isProcessing={isAIProcessing}
            currentAction={currentAIAction}
            hasContent={content.trim().length > 0}
          />
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
            disabled={isAIProcessing}
            defaultLanguage={voiceLanguage}
            compact
          />
        </div>
      </div>

      {/* Content Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Story Content</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={content}
            onChange={handleContentChange}
            placeholder="Start writing your story... Use headings, formatting, and images to make it engaging."
            storyId={storyId}
            autoSave={true}
            onAutoSave={handleAutoSave}
          />
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Tips for writing a great story:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Use headings to structure your story into sections</li>
              <li>Add images to make your story more engaging</li>
              <li>Use the AI Assist toolbar to improve, expand, or translate your writing</li>
              <li>Click the microphone icon to add content using voice input</li>
              <li>Your content is automatically saved as you type</li>
              <li>Generate a description to help readers discover your story</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Story Generation Config Dialog */}
      <StoryGenerationConfigDialog
        storyId={storyId}
        storyType="blog_story"
        open={showGenerationDialog}
        onOpenChange={setShowGenerationDialog}
        onComplete={() => router.push(`/story/${storyId}`)}
      />
    </div>
  );
}

function formatLastSaved(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;

  return date.toLocaleDateString();
}
