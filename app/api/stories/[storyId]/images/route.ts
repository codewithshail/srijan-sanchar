import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import Replicate from "replicate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Get story content
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
      with: {
        summary: true,
      },
    });

    if (!story) {
      return new NextResponse("Story not found", { status: 404 });
    }

    // Get story content for prompt generation
    const storyContent = story.content || story.summary?.longFormStory || story.summary?.userSummary || "";
    const storyTitle = story.title || "My Story";

    if (!storyContent) {
      return NextResponse.json(
        { error: "Story has no content to generate images from" },
        { status: 400 }
      );
    }

    // Generate image prompts using AI
    const bannerPrompt = await generateImagePrompt(storyTitle, storyContent, "banner");
    const thumbnailPrompt = await generateImagePrompt(storyTitle, storyContent, "thumbnail");

    // Generate images using Replicate
    const [bannerImages, thumbnailImages] = await Promise.all([
      generateMultipleImages(bannerPrompt, 3),
      generateMultipleImages(thumbnailPrompt, 3),
    ]);

    return NextResponse.json({
      bannerImages,
      thumbnailImages,
      prompts: {
        banner: bannerPrompt,
        thumbnail: thumbnailPrompt,
      },
    });
  } catch (error) {
    console.error("Image generation error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

async function generateImagePrompt(
  title: string,
  content: string,
  type: "banner" | "thumbnail"
): Promise<string> {
  try {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      // Fallback prompts if AI is not available
      const fallbackPrompts = {
        banner: `A cinematic, wide banner image representing the story "${title}". Warm lighting, emotional depth, photorealistic style.`,
        thumbnail: `A compelling square thumbnail for the story "${title}". Eye-catching, emotional, suitable for social media.`,
      };
      return fallbackPrompts[type];
    }

    const systemPrompt = type === "banner" 
      ? "Create a detailed prompt for a cinematic banner image (16:9 aspect ratio) that captures the essence of this story. Focus on mood, atmosphere, and visual storytelling. Keep it under 100 words."
      : "Create a detailed prompt for a square thumbnail image that would make someone want to read this story. Focus on emotional impact and visual appeal. Keep it under 80 words.";

    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      system: systemPrompt,
      prompt: `Story Title: ${title}\n\nStory Content: ${content.slice(0, 1000)}...\n\nGenerate only the image prompt, no additional text.`,
    });

    return text.trim();
  } catch (error) {
    console.error("AI prompt generation failed:", error);
    // Return fallback prompt
    const fallbackPrompts = {
      banner: `A cinematic, wide banner image representing the story "${title}". Warm lighting, emotional depth, photorealistic style.`,
      thumbnail: `A compelling square thumbnail for the story "${title}". Eye-catching, emotional, suitable for social media.`,
    };
    return fallbackPrompts[type];
  }
}

async function generateMultipleImages(prompt: string, count: number): Promise<string[]> {
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  
  if (!replicateToken) {
    throw new Error("Missing REPLICATE_API_TOKEN");
  }

  const replicate = new Replicate({ auth: replicateToken });
  const model: `${string}/${string}` | `${string}/${string}:${string}` =
    (process.env.REPLICATE_MODEL as
      | `${string}/${string}`
      | `${string}/${string}:${string}`) || "black-forest-labs/flux-dev";

  try {
    // Generate multiple images concurrently
    const imagePromises = Array.from({ length: count }, async () => {
      const output = await replicate.run(model, {
        input: { prompt },
      });
      return Array.isArray(output) ? String(output[0]) : String(output);
    });

    const images = await Promise.all(imagePromises);
    return images;
  } catch (error) {
    console.error("Replicate image generation failed:", error);
    throw error;
  }
}