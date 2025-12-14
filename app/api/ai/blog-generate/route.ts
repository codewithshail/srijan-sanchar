import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";

const bodySchema = z.object({
  prompt: z.string().min(1),
  contextHtml: z.string().optional(),
  generationType: z.enum([
    "paragraph",
    "introduction",
    "conclusion",
    "outline",
    "dialogue",
    "description",
    "transition"
  ]),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  tone: z.enum([
    "professional",
    "casual",
    "creative",
    "academic",
    "conversational",
    "humorous",
    "dramatic",
    "engaging",
    "thoughtful",
    "natural"
  ]).default("conversational"),
  storyId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      console.error("[BLOG_GENERATE] No userId from auth");
      return NextResponse.json({ error: "Please sign in to use AI content generation" }, { status: 401 });
    }

    console.log("[BLOG_GENERATE] Authenticated user:", userId);

    const body = await req.json();
    console.log("[BLOG_GENERATE] Request body:", body);

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      console.error("[BLOG_GENERATE] Validation error:", parsed.error.issues);
      return NextResponse.json({
        error: "Invalid input",
        details: parsed.error.issues
      }, { status: 400 });
    }

    const { prompt, contextHtml, generationType, length, tone, storyId } = parsed.data;

    // Check if API key is available
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      console.error("[BLOG_GENERATE] Missing GOOGLE_GENERATIVE_AI_API_KEY");
      return NextResponse.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" }, { status: 500 });
    }

    const model = google("gemini-2.0-flash");

    // Define length guidelines
    const lengthGuide = {
      short: "1-2 sentences",
      medium: "1-2 paragraphs (3-5 sentences each)",
      long: "3-4 paragraphs (4-6 sentences each)"
    };

    let systemPrompt = "";

    switch (generationType) {
      case "paragraph":
        systemPrompt = `You are a creative writing assistant for blog stories.
Generate a ${length} paragraph based on the user's prompt.
Use a ${tone} tone and make it engaging and well-written.
Length: ${lengthGuide[length]}`;
        break;

      case "introduction":
        systemPrompt = `You are a writing assistant specializing in compelling introductions for blog stories.
Create an engaging introduction that hooks the reader and sets up the story.
Use a ${tone} tone and make it ${length === "short" ? "concise" : length === "medium" ? "moderately detailed" : "comprehensive"}.
Length: ${lengthGuide[length]}`;
        break;

      case "conclusion":
        systemPrompt = `You are a writing assistant specializing in satisfying conclusions for blog stories.
Create a conclusion that wraps up the story meaningfully and leaves a lasting impression.
Use a ${tone} tone and make it ${length === "short" ? "concise" : length === "medium" ? "thoughtful" : "comprehensive"}.
Length: ${lengthGuide[length]}`;
        break;

      case "outline":
        systemPrompt = `You are a story structure assistant for blog stories.
Create a clear, organized outline based on the user's prompt.
Use a ${tone} approach and structure it logically.
Include main points and subpoints as appropriate.`;
        break;

      case "dialogue":
        systemPrompt = `You are a dialogue writing specialist for blog stories.
Create realistic, engaging dialogue based on the user's prompt.
Use a ${tone} tone and make the conversation feel natural and purposeful.
Length: ${lengthGuide[length]}`;
        break;

      case "description":
        systemPrompt = `You are a descriptive writing specialist for blog stories.
Create vivid, immersive descriptions based on the user's prompt.
Use a ${tone} tone and rich sensory details to bring the scene to life.
Length: ${lengthGuide[length]}`;
        break;

      case "transition":
        systemPrompt = `You are a writing assistant specializing in smooth transitions for blog stories.
Create a natural transition that connects ideas or scenes based on the user's prompt.
Use a ${tone} tone and make the flow seamless.
Length: ${lengthGuide[length]}`;
        break;

      default:
        return NextResponse.json({ error: "Invalid generation type" }, { status: 400 });
    }

    const fullPrompt = `${systemPrompt}

Context from the story (HTML may include headings and images, use it to maintain consistency):
${contextHtml ?? "(no additional context)"}

User prompt: ${prompt}

Generate the requested content. Return only the generated text, without markdown formatting or commentary.`;

    const { text: generated } = await generateText({ model, prompt: fullPrompt });

    return NextResponse.json({
      generated: generated?.trim(),
      generationType,
      length,
      tone
    });

  } catch (e: any) {
    console.error("Blog content generation error:", e);
    return NextResponse.json(
      { error: e?.message || "Content generation failed" },
      { status: 500 }
    );
  }
}