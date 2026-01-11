"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Check, Eye, Globe, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface PublicationWorkflowProps {
  storyId: string;
  initialTitle?: string;
  onComplete?: () => void;
}

interface ImageOption {
  url: string;
  selected: boolean;
}

interface GeneratedImages {
  bannerImages: string[];
  thumbnailImages: string[];
  prompts: {
    banner: string;
    thumbnail: string;
  };
}

export function PublicationWorkflow({
  storyId,
  initialTitle = "",
  onComplete
}: PublicationWorkflowProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public_summary" | "public_long">("private");

  const [bannerImages, setBannerImages] = useState<ImageOption[]>([]);
  const [thumbnailImages, setThumbnailImages] = useState<ImageOption[]>([]);
  const [selectedBanner, setSelectedBanner] = useState<string>("");
  const [selectedThumbnail, setSelectedThumbnail] = useState<string>("");

  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [imagesGenerated, setImagesGenerated] = useState(false);

  // Generate initial images when component mounts
  useEffect(() => {
    generateImages();
  }, []);

  const generateImages = async () => {
    setIsGeneratingImages(true);
    try {
      const response = await fetch(`/api/stories/${storyId}/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate images");
      }

      const data: GeneratedImages = await response.json();

      // Set banner images with first one selected by default
      const bannerOptions = data.bannerImages.map((url, index) => ({
        url,
        selected: index === 0,
      }));
      setBannerImages(bannerOptions);
      setSelectedBanner(data.bannerImages[0] || "");

      // Set thumbnail images with first one selected by default
      const thumbnailOptions = data.thumbnailImages.map((url, index) => ({
        url,
        selected: index === 0,
      }));
      setThumbnailImages(thumbnailOptions);
      setSelectedThumbnail(data.thumbnailImages[0] || "");

      setImagesGenerated(true);
      toast.success("Images generated successfully!");
    } catch (error) {
      console.error("Image generation failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate images");
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const regenerateImages = async () => {
    await generateImages();
  };

  const handleBannerSelect = (url: string) => {
    setSelectedBanner(url);
    setBannerImages(prev =>
      prev.map(img => ({ ...img, selected: img.url === url }))
    );
  };

  const handleThumbnailSelect = (url: string) => {
    setSelectedThumbnail(url);
    setThumbnailImages(prev =>
      prev.map(img => ({ ...img, selected: img.url === url }))
    );
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title for your story");
      return;
    }

    if (!selectedBanner || !selectedThumbnail) {
      toast.error("Please select both banner and thumbnail images");
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch(`/api/stories/${storyId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          visibility,
          bannerImageUrl: selectedBanner,
          thumbnailImageUrl: selectedThumbnail,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to publish story");
      }

      const result = await response.json();

      if (visibility === "private") {
        toast.success("Story saved as private!");
      } else {
        toast.success("Story published successfully!");
      }

      // Call completion callback or redirect
      if (onComplete) {
        onComplete();
      } else {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Publication failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to publish story");
    } finally {
      setIsPublishing(false);
    }
  };

  const getVisibilityIcon = (vis: string) => {
    switch (vis) {
      case "private": return <Lock className="h-4 w-4" />;
      case "public_summary": return <Eye className="h-4 w-4" />;
      case "public_long": return <Globe className="h-4 w-4" />;
      default: return <Lock className="h-4 w-4" />;
    }
  };

  const getVisibilityDescription = (vis: string) => {
    switch (vis) {
      case "private": return "Only you can see this story";
      case "public_summary": return "Others can see the summary";
      case "public_long": return "Others can see the full story";
      default: return "";
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Publish Your Story</h1>
        <p className="text-muted-foreground">
          Add images and choose how you want to share your story
        </p>
      </div>

      {/* Story Details */}
      <Card>
        <CardHeader>
          <CardTitle>Story Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your story title"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your story"
              className="mt-1"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Visibility Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={visibility} onValueChange={(value: any) => setVisibility(value)}>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="private" id="private" />
                <div className="flex-1">
                  <Label htmlFor="private" className="flex items-center gap-2 cursor-pointer">
                    <Lock className="h-4 w-4" />
                    Keep Private
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only you can see this story
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="public_summary" id="public_summary" />
                <div className="flex-1">
                  <Label htmlFor="public_summary" className="flex items-center gap-2 cursor-pointer">
                    <Eye className="h-4 w-4" />
                    Share Summary
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Others can see a summary of your story
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="public_long" id="public_long" />
                <div className="flex-1">
                  <Label htmlFor="public_long" className="flex items-center gap-2 cursor-pointer">
                    <Globe className="h-4 w-4" />
                    Share Full Story
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Others can read your complete story
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Banner Images */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Banner Image</CardTitle>
          <LoadingButton
            variant="outline"
            size="sm"
            onClick={regenerateImages}
            loading={isGeneratingImages}
            disabled={isGeneratingImages}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </LoadingButton>
        </CardHeader>
        <CardContent>
          {isGeneratingImages && !imagesGenerated ? (
            <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">Generating banner images...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bannerImages.map((image, index) => (
                <div
                  key={index}
                  className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${selectedBanner === image.url
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                    }`}
                  onClick={() => handleBannerSelect(image.url)}
                >
                  <img
                    src={image.url}
                    alt={`Banner option ${index + 1}`}
                    className="w-full h-32 object-cover"
                  />
                  {selectedBanner === image.url && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="default" className="bg-primary">
                        <Check className="h-3 w-3 mr-1" />
                        Selected
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thumbnail Images */}
      <Card>
        <CardHeader>
          <CardTitle>Thumbnail Image</CardTitle>
        </CardHeader>
        <CardContent>
          {isGeneratingImages && !imagesGenerated ? (
            <div className="flex items-center justify-center h-32 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">Generating thumbnail images...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {thumbnailImages.map((image, index) => (
                <div
                  key={index}
                  className={`relative cursor-pointer border-2 rounded-lg overflow-hidden transition-all aspect-square ${selectedThumbnail === image.url
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                    }`}
                  onClick={() => handleThumbnailSelect(image.url)}
                >
                  <img
                    src={image.url}
                    alt={`Thumbnail option ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {selectedThumbnail === image.url && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="default" className="bg-primary">
                        <Check className="h-3 w-3 mr-1" />
                        Selected
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end">
        <Button
          variant="outline"
          onClick={() => router.back()}
          disabled={isPublishing}
        >
          Cancel
        </Button>

        <LoadingButton
          onClick={handlePublish}
          loading={isPublishing}
          disabled={!imagesGenerated || isGeneratingImages || !title.trim()}
          className="min-w-[120px]"
        >
          {visibility === "private" ? "Save as Private" : "Publish Story"}
        </LoadingButton>
      </div>
    </div>
  );
}