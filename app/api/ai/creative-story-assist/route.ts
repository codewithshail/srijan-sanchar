import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { geminiService } from "@/lib/ai";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/languages";

const bodySchema = z.object({
  text: z.string().min(1, "Text is required"),
  action: z.enum(["rewrite", "grammar", "expand", "translate", "suggest", "generate_description"]),
  targetLanguage: z.string().optional(),
  tone: z.enum(["formal", "casual", "poetic", "narrative"]).optional(),
  storyTitle: z.string().optional(),
  context: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { text, action, targetLanguage, tone, storyTitle, context } = parsed.data;

    let result: string;

    switch (action) {
      case "rewrite":
        result = await geminiService.rewriteContent(text, tone || "narrative");
        break;

      case "grammar":
        result = await geminiService.improveGrammar(text, targetLanguage || "en");
        break;

      case "expand":
        const expandContext = storyTitle 
          ? `This is content from a creative story titled "${storyTitle}".${context ? ` Additional context: ${context}` : ""}`
          : context || "";
        result = await geminiService.expandContent(text, expandContext);
        break;

      case "translate":
        if (!targetLanguage) {
          return NextResponse.json(
            { error: "Target language is required for translation" },
            { status: 400 }
          );
        }
        const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage);
        const langName = langInfo?.name || targetLanguage;
        result = await geminiService.translateText(text, langName);
        break;

      case "suggest":
        result = await generateSuggestions(text, storyTitle || "", context || "");
        break;

      case "generate_description":
        result = await generateDescription(text, storyTitle || "");
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({
      result,
      action,
      originalLength: text.length,
      resultLength: result.length,
    });
  } catch (error: unknown) {
    console.error("[CREATIVE_STORY_ASSIST_ERROR]", error);
    
    const errorObj = error as { type?: string; retryAfter?: number; message?: string };
    if (errorObj?.type === "rate_limit") {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later.", retryAfter: errorObj.retryAfter },
        { status: 429 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "AI assistance failed";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

async function generateSuggestions(
  text: string,
  storyTitle: string,
  context: string
): Promise<string> {
  const prompt = `You are a helpful creative writing assistant. 
Based on the following content from a story${storyTitle ? ` titled "${storyTitle}"` : ""}, 
provide 2-3 brief, thoughtful suggestions to help improve the writing.

Current content:
${text}

${context ? `Additional context: ${context}` : ""}

Provide suggestions that:
1. Enhance the narrative flow and engagement
2. Suggest adding sensory details or emotional depth
3. Improve character development or scene setting

Format your response as a numbered list of suggestions. Keep each suggestion concise (1-2 sentences).`;

  const { text: suggestions } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
  });

  return suggestions;
}

async function generateDescription(
  content: string,
  storyTitle: string
): Promise<string> {
  // Strip HTML tags for analysis
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (plainText.length < 50) {
    return "Add more content to generate a description.";
  }

  const prompt = `You are a skilled copywriter. Generate a compelling, concise description (2-3 sentences, max 200 characters) for a story based on its content.

${storyTitle ? `Story Title: "${storyTitle}"` : ""}

Story Content:
${plainText.substring(0, 2000)}

Requirements:
- Capture the essence of the story without spoilers
- Make it engaging and intriguing
- Keep it under 200 characters
- Do not use quotes or special formatting

Return only the description text, nothing else.`;

  const { text: description } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
  });

  return description.trim();
}

export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES,
    actions: ["rewrite", "grammar", "expand", "translate", "suggest", "generate_description"],
    tones: ["formal", "casual", "poetic", "narrative"],
  });
}
