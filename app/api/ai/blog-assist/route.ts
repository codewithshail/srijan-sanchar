import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";

const bodySchema = z.object({
  text: z.string().min(1),
  contextHtml: z.string().optional(),
  assistType: z.enum([
    "improve", 
    "extend", 
    "rewrite", 
    "summarize", 
    "tone_adjust"
  ]),
  toneTarget: z.enum([
    "professional", 
    "casual", 
    "creative", 
    "academic", 
    "conversational"
  ]).optional(),
  storyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { text, contextHtml, assistType, toneTarget, storyId } = parsed.data;

    const model = google("gemini-1.5-flash");
    
    let prompt = "";
    
    switch (assistType) {
      case "improve":
        prompt = `You are an expert writing assistant for blog stories. 
Improve the grammar, clarity, and flow of the provided text while preserving the author's voice and style.
Make the writing more engaging and readable without changing the core message.
Return only the improved text, without markdown or commentary.

Context (HTML may include headings and images, use it to maintain consistency):
${contextHtml ?? "(no additional context)"}

Original text:
${text}`;
        break;

      case "extend":
        prompt = `You are a creative writing assistant for blog stories.
Extend the provided text by adding 2-3 more sentences that naturally continue the narrative or idea.
Match the author's writing style and tone. Keep the extension relevant and engaging.
Return only the original text plus the extension, without markdown or commentary.

Context (HTML may include headings and images, use it to maintain consistency):
${contextHtml ?? "(no additional context)"}

Text to extend:
${text}`;
        break;

      case "rewrite":
        prompt = `You are a skilled writing assistant for blog stories.
Rewrite the provided text to make it more engaging and compelling while keeping the same meaning.
Use varied sentence structure, stronger verbs, and more vivid descriptions.
${toneTarget ? `Adjust the tone to be more ${toneTarget}.` : ""}
Return only the rewritten text, without markdown or commentary.

Context (HTML may include headings and images, use it to maintain consistency):
${contextHtml ?? "(no additional context)"}

Text to rewrite:
${text}`;
        break;

      case "summarize":
        prompt = `You are a concise writing assistant for blog stories.
Create a clear, engaging summary of the provided text that captures the key points.
Make it about 1/3 the length of the original while maintaining the essential message.
Return only the summary, without markdown or commentary.

Context (HTML may include headings and images, use it to maintain consistency):
${contextHtml ?? "(no additional context)"}

Text to summarize:
${text}`;
        break;

      case "tone_adjust":
        if (!toneTarget) {
          return NextResponse.json({ error: "Tone target required for tone adjustment" }, { status: 400 });
        }
        prompt = `You are a writing assistant specializing in tone adjustment for blog stories.
Rewrite the provided text to match a ${toneTarget} tone while keeping the same meaning and information.
Adjust word choice, sentence structure, and style to fit the target tone.
Return only the adjusted text, without markdown or commentary.

Context (HTML may include headings and images, use it to maintain consistency):
${contextHtml ?? "(no additional context)"}

Text to adjust:
${text}`;
        break;

      default:
        return NextResponse.json({ error: "Invalid assist type" }, { status: 400 });
    }

    const { text: improved } = await generateText({ model, prompt });
    
    return NextResponse.json({ 
      improved: improved?.trim(),
      assistType,
      toneTarget 
    });
    
  } catch (e: any) {
    console.error("Blog AI Assist error:", e);
    return NextResponse.json(
      { error: e?.message || "AI Assist failed" },
      { status: 500 }
    );
  }
}