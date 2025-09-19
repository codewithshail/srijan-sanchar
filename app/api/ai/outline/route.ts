import { NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(request: Request) {
  try {
    const { title, content } = await request.json().catch(() => ({} as any));

    // graceful fallback when key missing
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const outline = `# ${
        title || "Story"
      }\n\n## Introduction\n\n## Key Moments\n\n## Reflections\n\n## Conclusion`;
      return NextResponse.json({ outline });
    }

    // attempt AI generation
    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      system:
        "Create a clean markdown outline with headings and subheadings for a personal story.",
      prompt: `Title: ${title || "Story"}\nContext: ${
        content || ""
      }\nReturn markdown outline only.`,
    });

    return NextResponse.json({ outline: text?.trim?.() || "" });
  } catch (error: any) {
    // Provide a safe outline instead of 500, plus minimal debug logging
    console.log("[v0] /api/ai/outline error:", error?.message || error);
    const safeOutline = `# Story\n\n## Introduction\n\n## Key Moments\n\n## Reflections\n\n## Conclusion`;
    return NextResponse.json(
      { outline: safeOutline, error: "AI fallback used" },
      { status: 200 }
    );
  }
}
