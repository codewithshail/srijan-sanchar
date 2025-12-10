"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { Button, LoadingButton } from "@/components/ui/button";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  ListIcon,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link2,
  ImagePlus,
  Sparkles,
  Save,
  Clock,
  FileText,
  Wand2,
  Lightbulb,
  PlusCircle,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// A fully-featured TipTap editor with toolbar. Controlled via HTML string.
export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  storyId?: string;
  autoSave?: boolean;
  onAutoSave?: (content: string) => Promise<void>;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your story...",
  storyId,
  autoSave = false,
  onAutoSave,
}: RichTextEditorProps) {
  const [aiBusy, setAiBusy] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [aiGenerateDialogOpen, setAiGenerateDialogOpen] = useState(false);
  const [aiSuggestionsDialogOpen, setAiSuggestionsDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("Story image");
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save functionality
  const triggerAutoSave = useCallback(async (content: string) => {
    if (!autoSave || !onAutoSave || !storyId) return;
    
    try {
      setIsAutoSaving(true);
      await onAutoSave(content);
      setLastSaved(new Date());
    } catch (error) {
      console.error("Auto-save failed:", error);
      toast.error("Auto-save failed");
    } finally {
      setIsAutoSaving(false);
    }
  }, [autoSave, onAutoSave, storyId]);

  // Calculate word count and reading time
  const getTextStats = useCallback((html: string) => {
    if (!html) return { wordCount: 0, readingTime: 0 };
    
    // Create a temporary div to extract text from HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const readingTime = Math.ceil(wordCount / 200); // Average reading speed: 200 words per minute
    
    return { wordCount, readingTime };
  }, []);

  const { wordCount, readingTime } = getTextStats(value);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        bulletList: {
          HTMLAttributes: {
            class: "list-disc list-inside",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "list-decimal list-inside",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "border-l-4 border-gray-300 pl-4 italic",
          },
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-md border shadow-sm",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose max-w-none min-h-[400px] focus:outline-none px-3 py-2 rounded-md border bg-background focus:ring-2 focus:ring-ring focus:ring-offset-2 locale-content indic-text",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      
      // Trigger auto-save with debounce
      if (autoSave && onAutoSave) {
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
          triggerAutoSave(html);
        }, 2000); // Auto-save after 2 seconds of inactivity
      }
    },
  });

  // Keep external value in sync (controlled)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) return null;

  const handleLinkSubmit = () => {
    if (!linkUrl.trim()) {
      // Remove link if URL is empty
      editor.chain().focus().unsetLink().run();
    } else {
      // Set link
      let url = linkUrl.trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      editor.chain().focus().setLink({ href: url }).run();
    }
    setLinkDialogOpen(false);
    setLinkUrl("");
  };

  const handleImageSubmit = () => {
    if (imageUrl.trim()) {
      editor
        .chain()
        .focus()
        .setImage({
          src: imageUrl.trim(),
          alt: imageAlt.trim() || "Story image",
        })
        .run();
    }
    setImageDialogOpen(false);
    setImageUrl("");
    setImageAlt("Story image");
  };

  const openLinkDialog = () => {
    const currentLinkUrl = editor.getAttributes("link").href || "";
    setLinkUrl(currentLinkUrl);
    setLinkDialogOpen(true);
  };

  const openImageDialog = () => {
    setImageUrl("");
    setImageAlt("Story image");
    setImageDialogOpen(true);
  };

  const aiAssist = async (assistType: string = "improve", toneTarget?: string) => {
    if (!editor) return;

    const sel = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      "\n"
    );
    const text = sel || editor.getText();

    if (!text?.trim()) {
      toast.error("Please write some content first");
      return;
    }

    try {
      setAiBusy(true);
      const res = await fetch("/api/ai/blog-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          contextHtml: editor.getHTML(),
          assistType,
          toneTarget,
          storyId,
        }),
      });

      if (!res.ok) {
        throw new Error("AI Assist failed");
      }

      const { improved } = await res.json();

      // Replace selection or insert at cursor
      if (sel) {
        editor.chain().focus().deleteSelection().insertContent(improved).run();
      } else {
        editor.chain().focus().selectAll().insertContent(improved).run();
      }

      toast.success(`Content ${assistType === "improve" ? "improved" : assistType === "extend" ? "extended" : "rewritten"} with AI`);
    } catch (error) {
      console.error("AI Assist error:", error);
      toast.error("AI assistance failed. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const generateContent = async (generationType: string, length: string = "medium", tone: string = "conversational") => {
    if (!editor || !generatePrompt.trim()) {
      toast.error("Please enter a prompt for content generation");
      return;
    }

    try {
      setAiBusy(true);
      const res = await fetch("/api/ai/blog-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: generatePrompt.trim(),
          contextHtml: editor.getHTML(),
          generationType,
          length,
          tone,
          storyId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || `Content generation failed (${res.status})`;
        throw new Error(errorMessage);
      }

      const { generated } = await res.json();

      // Insert generated content at cursor
      editor.chain().focus().insertContent(`\n\n${generated}\n\n`).run();

      toast.success("Content generated successfully");
      setAiGenerateDialogOpen(false);
      setGeneratePrompt("");
    } catch (error) {
      console.error("Content generation error:", error);
      toast.error("Content generation failed. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  const getSuggestions = async (suggestionType: string) => {
    if (!editor) return;

    try {
      setSuggestionsLoading(true);
      const res = await fetch("/api/ai/blog-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextHtml: editor.getHTML(),
          currentText: editor.getText(),
          suggestionType,
          storyId,
        }),
      });

      if (!res.ok) {
        throw new Error("Suggestions generation failed");
      }

      const { suggestions: newSuggestions } = await res.json();
      setSuggestions(newSuggestions);
      setAiSuggestionsDialogOpen(true);
    } catch (error) {
      console.error("Suggestions error:", error);
      toast.error("Failed to get suggestions. Please try again.");
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const toolbarBtn = (active: boolean) =>
    active
      ? "bg-accent text-accent-foreground"
      : "bg-background hover:bg-accent hover:text-accent-foreground";

  // Check if editor has content for AI assist button
  const hasContent = editor && editor.getText().trim().length > 0;

  // Manual save function
  const handleManualSave = async () => {
    if (!onAutoSave || !storyId) return;
    await triggerAutoSave(value);
  };

  // Format last saved time
  const formatLastSaved = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 minute ago";
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-2">
      {/* Stats and Auto-save Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 border rounded-md bg-muted/50">
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {wordCount} words
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {readingTime} min read
          </Badge>
          {autoSave && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isAutoSaving ? (
                <span className="flex items-center gap-1">
                  <Save className="h-3 w-3 animate-pulse" />
                  Saving...
                </span>
              ) : lastSaved ? (
                <span>Saved {formatLastSaved(lastSaved)}</span>
              ) : (
                <span>Auto-save enabled</span>
              )}
            </div>
          )}
        </div>
        {onAutoSave && storyId && (
          <LoadingButton
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualSave}
            loading={isAutoSaving}
            loadingText="Saving..."
            icon={<Save className="h-4 w-4" />}
          >
            Save
          </LoadingButton>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/50">
        {/* Text formatting */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("bold"))}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-pressed={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("italic"))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-pressed={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("underline"))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          aria-pressed={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("strike"))}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          aria-pressed={editor.isActive("strike")}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Headings */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("heading", { level: 1 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          aria-pressed={editor.isActive("heading", { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("heading", { level: 2 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          aria-pressed={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("heading", { level: 3 }))}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          aria-pressed={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Lists and quotes */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("bulletList"))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-pressed={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <ListIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("orderedList"))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-pressed={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive("blockquote"))}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          aria-pressed={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Text alignment */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive({ textAlign: "left" }))}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive({ textAlign: "center" }))}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={toolbarBtn(editor.isActive({ textAlign: "right" }))}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* Media and links */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openLinkDialog}
          title="Add Link"
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openImageDialog}
          title="Add Image"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* History */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        {/* AI Features */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <LoadingButton
              type="button"
              variant="outline"
              size="sm"
              loading={aiBusy}
              loadingText="Processing..."
              disabled={!hasContent}
              icon={<Sparkles className="h-4 w-4" />}
              title={!hasContent ? "Write some content first" : "AI writing assistance"}
            >
              AI Assist
              <ChevronDown className="h-3 w-3 ml-1" />
            </LoadingButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => aiAssist("improve")}>
              <Sparkles className="h-4 w-4 mr-2" />
              Improve Writing
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => aiAssist("extend")}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Extend Content
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => aiAssist("rewrite")}>
              <Wand2 className="h-4 w-4 mr-2" />
              Rewrite Selection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Tone Adjustments</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => aiAssist("tone_adjust", "professional")}>
              Professional Tone
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => aiAssist("tone_adjust", "casual")}>
              Casual Tone
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => aiAssist("tone_adjust", "creative")}>
              Creative Tone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAiGenerateDialogOpen(true)}
          title="Generate new content"
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          Generate
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <LoadingButton
              type="button"
              variant="outline"
              size="sm"
              loading={suggestionsLoading}
              loadingText="Loading..."
              icon={<Lightbulb className="h-4 w-4" />}
              title="Get writing suggestions"
            >
              Suggestions
              <ChevronDown className="h-3 w-3 ml-1" />
            </LoadingButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => getSuggestions("next_paragraph")}>
              Next Paragraph Ideas
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => getSuggestions("improve_flow")}>
              Improve Flow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => getSuggestions("add_details")}>
              Add More Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => getSuggestions("strengthen_opening")}>
              Strengthen Opening
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => getSuggestions("better_conclusion")}>
              Better Conclusion
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => getSuggestions("enhance_dialogue")}>
              Enhance Dialogue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-md border">
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLinkSubmit();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLinkSubmit}>
              {linkUrl.trim() ? "Add Link" : "Remove Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="image-alt">Alt Text (Optional)</Label>
              <Input
                id="image-alt"
                placeholder="Describe the image..."
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImageSubmit} disabled={!imageUrl.trim()}>
              Add Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Content Generation Dialog */}
      <Dialog open={aiGenerateDialogOpen} onOpenChange={setAiGenerateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Content with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="generate-prompt">What would you like to write about?</Label>
              <Textarea
                id="generate-prompt"
                placeholder="Describe what you want to generate... e.g., 'A paragraph about overcoming challenges' or 'An introduction to my childhood memories'"
                value={generatePrompt}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => generateContent("paragraph", "medium", "conversational")}
                disabled={!generatePrompt.trim() || aiBusy}
              >
                Generate Paragraph
              </Button>
              <Button
                variant="outline"
                onClick={() => generateContent("introduction", "medium", "engaging")}
                disabled={!generatePrompt.trim() || aiBusy}
              >
                Write Introduction
              </Button>
              <Button
                variant="outline"
                onClick={() => generateContent("conclusion", "medium", "thoughtful")}
                disabled={!generatePrompt.trim() || aiBusy}
              >
                Write Conclusion
              </Button>
              <Button
                variant="outline"
                onClick={() => generateContent("dialogue", "medium", "natural")}
                disabled={!generatePrompt.trim() || aiBusy}
              >
                Create Dialogue
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiGenerateDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Suggestions Dialog */}
      <Dialog open={aiSuggestionsDialogOpen} onOpenChange={setAiSuggestionsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Writing Suggestions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-md bg-muted/50 text-sm"
                >
                  {suggestion}
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-4">
                No suggestions available
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setAiSuggestionsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
