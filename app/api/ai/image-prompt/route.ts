import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { geminiService } from "@/lib/ai";

/**
 * Request body for image prompt generation
 */
interface ImagePromptRequest {
  /** Story title */
  title?: string;
  /** Story content to generate prompts from */
  content: string;
  /** Number of prompts to generate */
  numberOfPrompts?: number;
  /** Image style preference */
  style?: 'realistic' | 'artistic' | 'minimalist';
  /** Target audience */
  targetAudience?: 'children' | 'adults' | 'all';
}

// POST /api/ai/image-prompt - Generate image prompts from story content
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ImagePromptRequest = await request.json();
    const { title, content, numberOfPrompts = 1, style = 'realistic', targetAudience = 'adults' } = body;

    if (!content || content.trim().length < 50) {
      return NextResponse.json(
        { error: "Content must be at least 50 characters" },
        { status: 400 }
      );
    }

    // Limit number of prompts
    const promptCount = Math.min(Math.max(numberOfPrompts, 1), 10);

    // Check if Gemini is configured
    if (!geminiService.isConfigured()) {
      // Return fallback prompts
      const fallbackPrompts = Array(promptCount)
        .fill(0)
        .map((_, i) => {
          const titlePart = title ? `for "${title}"` : '';
          return `A warm, evocative ${style} scene ${titlePart}, image ${i + 1}`;
        });

      return NextResponse.json({
        prompts: fallbackPrompts,
        isFallback: true,
        message: "AI service not configured, using fallback prompts",
      });
    }

    // Generate prompts using Gemini
    const storyContent = title ? `Title: ${title}\n\n${content}` : content;
    
    const prompts = await geminiService.generateImagePrompts(
      storyContent,
      promptCount,
      {
        style,
        targetAudience,
      }
    );

    return NextResponse.json({
      prompts,
      isFallback: false,
      style,
      targetAudience,
    });
  } catch (error) {
    console.error("[IMAGE_PROMPT_ERROR]", error);
    
    // Check if it's a rate limit error
    if (error && typeof error === 'object' && 'type' in error) {
      const aiError = error as { type: string; message: string; retryAfter?: number };
      if (aiError.type === 'rate_limit') {
        return NextResponse.json(
          { 
            error: "Rate limit exceeded", 
            retryAfter: aiError.retryAfter,
            message: aiError.message,
          },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate image prompts" },
      { status: 500 }
    );
  }
}
