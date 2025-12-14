import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { geminiService } from "@/lib/ai";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/languages";

const bodySchema = z.object({
  text: z.string().min(1, "Text is required"),
  action: z.enum(["rewrite", "grammar", "expand", "translate", "suggest", "generate_description", "improve_description", "generate_description_from_title", "improve_title", "generate_title_from_content"]),
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

      case "improve_description":
        result = await improveDescription(text, storyTitle || "");
        break;

      case "generate_description_from_title":
        result = await generateDescriptionFromTitle(text);
        break;

      case "improve_title":
        result = await improveTitle(text);
        break;

      case "generate_title_from_content":
        result = await generateTitleFromContent(text);
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

async function improveDescription(
  existingDescription: string,
  storyTitle: string
): Promise<string> {
  const prompt = `You are a skilled copywriter. Improve the following story description to make it more compelling and engaging.

${storyTitle ? `Story Title: "${storyTitle}"` : ""}

Current Description:
${existingDescription}

Requirements:
- Make it more engaging and intriguing
- Keep the core message but enhance the language
- Keep it concise (2-3 sentences, max 200 characters)
- Do not use quotes or special formatting

Return only the improved description text, nothing else.`;

  const { text: description } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
  });

  return description.trim();
}

async function generateDescriptionFromTitle(
  storyTitle: string
): Promise<string> {
  const prompt = `You are a skilled copywriter. Generate a compelling, intriguing description (2-3 sentences, max 200 characters) for a story based only on its title.

Story Title: "${storyTitle}"

Requirements:
- Create an enticing description that sparks curiosity
- Make it engaging and intriguing
- Keep it under 200 characters
- Do not use quotes or special formatting
- Be creative but keep it relevant to the title

Return only the description text, nothing else.`;

  const { text: description } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
  });

  return description.trim();
}

async function improveTitle(
  existingTitle: string
): Promise<string> {
  const prompt = `You are a skilled copywriter. Improve the following story title to make it more compelling, engaging, and memorable.

Current Title: "${existingTitle}"

Requirements:
- Make it more captivating and intriguing
- Keep it concise (max 10 words)
- Do not use quotation marks in your response
- Return only the improved title, nothing else

Improved title:`;

  const { text: title } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
  });

  return title.trim().replace(/^"|"$/g, '');
}

async function generateTitleFromContent(
  content: string
): Promise<string> {
  // Strip HTML tags for analysis
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  const prompt = `You are a skilled copywriter. Generate a compelling, engaging title for a story based on its content.

Story Content:
${plainText.substring(0, 2000)}

Requirements:
- Create a captivating title that captures the essence of the story
- Keep it concise (max 10 words)
- Make it memorable and intriguing
- Do not use quotation marks in your response
- Return only the title, nothing else

Title:`;

  const { text: title } = await generateText({
    model: google("gemini-2.0-flash"),
    prompt,
  });

  return title.trim().replace(/^"|"$/g, '');
}

export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES,
    actions: ["rewrite", "grammar", "expand", "translate", "suggest", "generate_description", "improve_description", "generate_description_from_title", "improve_title", "generate_title_from_content"],
    tones: ["formal", "casual", "poetic", "narrative"],
  });
}
