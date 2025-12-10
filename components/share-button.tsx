"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Share2,
  Copy,
  Check,
  Mail,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Using generic icons since Twitter/Facebook/Linkedin are deprecated
const XIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

interface ShareButtonProps {
  storyId: string;
  storyTitle: string;
  storyDescription?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
  showCount?: boolean;
  shareCount?: number;
  className?: string;
  onShare?: (platform: string) => void;
}

export function ShareButton({
  storyId,
  storyTitle,
  storyDescription,
  variant = "ghost",
  size = "sm",
  showLabel = true,
  showCount = false,
  shareCount = 0,
  className,
  onShare,
}: ShareButtonProps) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const getShareUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/story/${storyId}`;
  }, [storyId]);

  // Track share event
  const trackShare = useCallback(async (platform: string) => {
    try {
      await fetch(`/api/stories/${storyId}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType: "share", platform }),
      });
      onShare?.(platform);
    } catch {
      // Silently fail - don't block the share action
    }
  }, [storyId, onShare]);

  const copyLink = async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      toast.success("Link copied to clipboard!");
      trackShare("copy_link");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareOnSocial = (platform: string) => {
    const url = encodeURIComponent(getShareUrl());
    const title = encodeURIComponent(storyTitle || "Check out this story");
    const description = encodeURIComponent(
      storyDescription || "Read this amazing story on StoryWeave"
    );

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${title}%20${url}`,
      email: `mailto:?subject=${title}&body=${description}%0A%0A${url}`,
    };

    const shareUrl = shareUrls[platform];
    if (shareUrl) {
      if (platform === "email") {
        window.location.href = shareUrl;
      } else {
        window.open(shareUrl, "_blank", "width=600,height=400,noopener,noreferrer");
      }
    }

    // Track share event
    trackShare(platform);
  };

  // Use native share API if available
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: storyTitle,
          text: storyDescription || "Read this amazing story on StoryWeave",
          url: getShareUrl(),
        });
        // Track share event
        trackShare("native");
      } catch (err) {
        // User cancelled or error - show fallback dialog
        if ((err as Error).name !== "AbortError") {
          setShowShareDialog(true);
        }
      }
    } else {
      setShowShareDialog(true);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant={variant} 
            size={size} 
            className={cn("gap-2", className)}
            aria-label="Share this story"
          >
            <Share2 className="h-4 w-4" />
            {showLabel && <span className="hidden sm:inline">Share</span>}
            {showCount && shareCount > 0 && (
              <span className="tabular-nums text-muted-foreground">
                {shareCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={copyLink}>
            {linkCopied ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            Copy Link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => shareOnSocial("twitter")}>
            <span className="mr-2"><XIcon /></span>
            Share on X
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => shareOnSocial("facebook")}>
            <span className="mr-2"><FacebookIcon /></span>
            Share on Facebook
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => shareOnSocial("linkedin")}>
            <span className="mr-2"><LinkedInIcon /></span>
            Share on LinkedIn
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => shareOnSocial("whatsapp")}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Share on WhatsApp
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => shareOnSocial("email")}>
            <Mail className="h-4 w-4 mr-2" />
            Share via Email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Share Dialog for more options */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share this story</DialogTitle>
            <DialogDescription>
              Share &quot;{storyTitle}&quot; with your friends and followers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Copy Link Section */}
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={getShareUrl()}
                className="flex-1 text-sm"
              />
              <Button size="sm" onClick={copyLink}>
                {linkCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Social Share Buttons */}
            <div className="grid grid-cols-5 gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => shareOnSocial("twitter")}
                title="Share on X"
              >
                <XIcon />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => shareOnSocial("facebook")}
                title="Share on Facebook"
              >
                <FacebookIcon />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => shareOnSocial("linkedin")}
                title="Share on LinkedIn"
              >
                <LinkedInIcon />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => shareOnSocial("whatsapp")}
                title="Share on WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => shareOnSocial("email")}
                title="Share via Email"
              >
                <Mail className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
