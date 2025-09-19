"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, LoadingButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import RichTextEditor from "@/components/editor/rich-text-editor";
import { toast } from "sonner";

interface BlogStory {
  id: string;
  title: string;
  content: string;
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTitle, setIsSavingTitle] = useState(false);

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
        
        // Ensure this is a blog story
        if (storyData.storyType !== "blog_story") {
          toast.error("This editor is only for blog stories");
          router.push(`/editor/${storyId}`);
          return;
        }
        
        setStory(storyData);
        setTitle(storyData.title || "");
        setContent(storyData.content || "");
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
    } catch (error) {
      console.error("Auto-save failed:", error);
      throw error; // Re-throw to let the editor handle the error
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

  // Handle content change
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  // Navigate to preview
  const handlePreview = () => {
    if (!title.trim()) {
      toast.error("Please add a title first");
      return;
    }
    router.push(`/story/${storyId}`);
  };

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
            <p>The story you're looking for doesn't exist or you don't have permission to edit it.</p>
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
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={!title.trim()}>
            <Eye className="mr-2 h-4 w-4" />
            Preview Story
          </Button>
          <Button 
            onClick={() => router.push(`/publish/${storyId}`)} 
            disabled={!title.trim() || !content.trim()}
          >
            Publish Story
          </Button>
        </div>
      </div>

      {/* Title Editor */}
      <Card>
        <CardHeader>
          <CardTitle>Story Title</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter your story title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-semibold"
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
            >
              Save Title
            </LoadingButton>
          </div>
        </CardContent>
      </Card>

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
              <li>Use the AI Assist feature to improve your writing</li>
              <li>Your content is automatically saved as you type</li>
              <li>Click "Preview Story" to see how it will look to readers</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}