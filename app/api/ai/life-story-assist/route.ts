import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { geminiService } from "@/lib/ai";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/languages";

const bodySchema = z.object({
  text: z.string().min(1, "Text is required"),
  action: z.enum(["rewrite", "grammar", "expand", "translate", "suggest"]),
  targetLanguage: z.string().optional(),
  tone: z.enum(["formal", "casual", "poetic", "narrative"]).optional(),
  stageName: z.string().optional(),
  context: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check authentication
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

    const { text, action, targetLanguage, tone, stageName, context } = parsed.data;

    let result: string;

    switch (action) {
      case "rewrite":
        result = await geminiService.rewriteContent(text, tone || "narrative");
        break;

      case "grammar":
        result = await geminiService.improveGrammar(text, targetLanguage || "en");
        break;

      case "expand":
        const expandContext = stageName 
          ? `This is content from the "${stageName}" stage of a life story.${context ? ` Additional context: ${context}` : ""}`
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
        result = await generateSuggestions(text, stageName || "", context || "");
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
    console.error("[LIFE_STORY_ASSIST_ERROR]", error);
    
    // Handle rate limit errors
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

/**
 * Generate AI suggestions for life story content
 */
async function generateSuggestions(
  text: string,
  stageName: string,
  context: string
): Promise<string> {
  const { generateText } = await import("ai");
  const { google } = await import("@ai-sdk/google");

  const prompt = `You are a helpful writing assistant for life stories. 
Based on the following content from the "${stageName}" stage of someone's life story, 
provide 2-3 brief, thoughtful suggestions to help them expand or improve their writing.

Current content:
${text}

${context ? `Additional context: ${context}` : ""}

Provide suggestions that:
1. Ask thought-provoking questions about specific details
2. Suggest adding sensory details or emotions
3. Encourage deeper reflection on the experience

Format your response as a numbered list of suggestions. Keep each suggestion concise (1-2 sentences).`;

  const { text: suggestions } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
  });

  return suggestions;
}

// GET endpoint to retrieve supported languages
export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES,
    actions: ["rewrite", "grammar", "expand", "translate", "suggest"],
    tones: ["formal", "casual", "poetic", "narrative"],
  });
}
