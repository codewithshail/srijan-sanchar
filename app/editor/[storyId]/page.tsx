"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, LoadingButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, ImagePlus, ListChecks, Loader2 } from "lucide-react";
import RichTextEditor from "@/components/editor/rich-text-editor";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export default function EditorPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState(""); // HTML string for TipTap
  const [imageUrl, setImageUrl] = useState("");
  const [showWizardPrompt, setShowWizardPrompt] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isOutlineLoading, setIsOutlineLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [aiChoice, setAiChoice] = useState<"summary" | "full">("summary");
  const [isViewProcessing, setIsViewProcessing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/stories/${storyId}`);
        if (res.ok) {
          const data = await res.json();
          
          // Redirect blog stories to the blog editor
          if (data.storyType === "blog_story") {
            router.push(`/blog-editor/${storyId}`);
            return;
          }
          
          setTitle(data.title || "");
          // Load existing content if any
          if (data.content) {
            setContent(data.content);
          }
        }
      } catch (error) {
        console.error("Error loading story:", error);
        toast.error("Failed to load story");
      } finally {
        setIsLoading(false);
      }
    };
    if (storyId) {
      load();
    }
  }, [storyId, router]);

  const saveTitle = async () => {
    if (!title.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    try {
      setIsSavingTitle(true);
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) {
        throw new Error("Failed to save title");
      }
      toast.success("Title saved successfully");
    } catch (error) {
      console.error("Error saving title:", error);
      toast.error("Error saving title");
    } finally {
      setIsSavingTitle(false);
    }
  };

  const mdToHtml = (md: string) => {
    return md
      .split("\n")
      .map((line) => {
        if (line.startsWith("###"))
          return `<h3>${line.replace(/^###\s*/, "")}</h3>`;
        if (line.startsWith("##"))
          return `<h2>${line.replace(/^##\s*/, "")}</h2>`;
        if (line.startsWith("#"))
          return `<h1>${line.replace(/^#\s*/, "")}</h1>`;
        if (line.trim() === "") return "";
        return `<p>${line}</p>`;
      })
      .join("\n");
  };

  const outlineWithAI = async () => {
    if (!title.trim()) {
      toast.error("Please add a title first");
      return;
    }

    try {
      setIsOutlineLoading(true);
      const res = await fetch("/api/ai/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      });

      if (!res.ok) {
        throw new Error("AI outline generation failed");
      }

      const { outline } = await res.json();
      const outlineHtml = mdToHtml(outline || "");
      setContent((c) => `${c}\n${outlineHtml}`);
      toast.success("Outline added successfully");
    } catch (error) {
      console.error("Error generating outline:", error);
      toast.error("Could not generate outline. Please try again.");
    } finally {
      setIsOutlineLoading(false);
    }
  };

  const imagePromptAI = async () => {
    if (!title.trim()) {
      toast.error("Please add a title first");
      return;
    }

    try {
      setIsImageLoading(true);
      const promptRes = await fetch("/api/ai/image-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), content }),
      });

      if (!promptRes.ok) {
        throw new Error("Failed to generate image prompt");
      }

      const { prompt } = await promptRes.json();

      const genRes = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!genRes.ok) {
        throw new Error("Image generation failed");
      }

      const { url } = await genRes.json();
      setImageUrl(url || "");

      const attachRes = await fetch(`/api/stories/${storyId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, prompt }),
      });

      if (!attachRes.ok) {
        toast.warning("Image generated but could not attach to story");
      }

      // Insert into TipTap content immediately, styled small and centered.
      const figure = `<figure class="not-prose my-4 flex justify-center">
  <img src="${url}" alt="Story image" class="h-40 w-auto rounded-md border shadow-sm" />
</figure>`;
      setContent((c) => `${c}\n${figure}`);

      toast.success("Image generated and inserted successfully");
    } catch (error) {
      console.error("Error generating image:", error);
      toast.error("Could not generate image. Please try again.");
    } finally {
      setIsImageLoading(false);
    }
  };

// Replace your existing handleAsWritten and handleAIEnhanced functions with these:

const handleAsWritten = async () => {
  if (!title.trim()) {
    toast.error("Please add a title first");
    return;
  }

  try {
    setIsViewProcessing(true);
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        mode: "as-is",
        title: title.trim(),
        contentHtml: content,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to save story");
    }

    setViewDialogOpen(false);
    toast.success("Story saved successfully");
    
    // Redirect to story page
    router.push(`/story/${storyId}`);
  } catch (error) {
    console.error("Error saving story:", error);
    toast.error("Error while saving content. Please try again.");
  } finally {
    setIsViewProcessing(false);
  }
};

const handleAIEnhanced = async () => {
  if (!title.trim()) {
    toast.error("Please add a title first");
    return;
  }

  try {
    setIsViewProcessing(true);
    
    // First, call AI to generate enhanced content
    const aiRes = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        mode: "ai",
        storyType: aiChoice, // "summary" | "full"
        title: title.trim(),
        contentHtml: content,
      }),
    });

    if (!aiRes.ok) {
      const errorData = await aiRes.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "AI generation failed");
    }

    const aiResult = await aiRes.json();
    
    // Now save the AI-enhanced content
    const saveRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        mode: "ai-enhanced",
        title: title.trim(),
        contentHtml: aiResult.generatedContent || content,
        summary: aiResult.summary, // Pass the AI-generated summary
      }),
    });

    if (!saveRes.ok) {
      const errorData = await saveRes.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(errorData.error || "Failed to save enhanced story");
    }

    setViewDialogOpen(false);
    toast.success("Story generated and saved successfully");
    
    // Redirect to story page
    router.push(`/story/${storyId}`);
  } catch (error) {
    console.error("Error generating with AI:", error);
    toast.error("Error while generating with AI. Please try again.");
  } finally {
    setIsViewProcessing(false);
  }
};

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {showWizardPrompt && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Start with 7 Stages?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/wizard/${storyId}`}>Open 7-Stage Wizard</Link>
            </Button>
            <Button onClick={() => setShowWizardPrompt(false)}>
              Skip for now
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Input
          placeholder="Enter your story title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-lg font-semibold"
        />
        <LoadingButton
          onClick={saveTitle}
          loading={isSavingTitle}
          loadingText="Saving..."
          disabled={!title.trim()}
        >
          Save Title
        </LoadingButton>
      </div>

      <div className="flex flex-wrap gap-2">
        <LoadingButton
          variant="outline"
          onClick={outlineWithAI}
          loading={isOutlineLoading}
          loadingText="Generating..."
          disabled={!title.trim()}
          icon={<Sparkles className="h-4 w-4" />}
        >
          Outline with AI
        </LoadingButton>
        <LoadingButton
          variant="outline"
          onClick={imagePromptAI}
          loading={isImageLoading}
          loadingText="Generating..."
          disabled={!title.trim()}
          icon={<ImagePlus className="h-4 w-4" />}
        >
          Generate Image
        </LoadingButton>

        <AlertDialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="default" disabled={!title.trim()}>
              <ListChecks className="mr-2 h-4 w-4" /> View Story
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                How do you want to prepare your story?
              </AlertDialogTitle>
            </AlertDialogHeader>

            <div className="space-y-4">
              <div className="rounded border p-3">
                <p className="text-sm mb-2 font-medium">
                  AI Enhanced (choose one):
                </p>
                <RadioGroup
                  value={aiChoice}
                  onValueChange={(v: "summary" | "full") => setAiChoice(v)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem id="ai-summary" value="summary" />
                    <Label htmlFor="ai-summary">Generate Summary</Label>
                  </div>
                  <div className="flex items-center space-x-2 mt-1">
                    <RadioGroupItem id="ai-full" value="full" />
                    <Label htmlFor="ai-full">Generate Full Story</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground mt-2">
                  AI will improve grammar, clarity, and optionally expand to a
                  fuller narrative.
                </p>
              </div>

              <div className="rounded border p-3">
                <p className="text-sm font-medium">
                  Or proceed "As written" (no AI changes).
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Save your story exactly as you've written it.
                </p>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isViewProcessing}>
                Cancel
              </AlertDialogCancel>
              <LoadingButton
                onClick={handleAsWritten}
                loading={isViewProcessing}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save As Written
              </LoadingButton>
              <LoadingButton
                onClick={handleAIEnhanced}
                loading={isViewProcessing}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue with AI
              </LoadingButton>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="Write your story with headings, subheadings, lists, and images..."
      />
    </div>
  );
}
