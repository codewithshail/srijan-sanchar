import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { auth } from "@clerk/nextjs/server";

const bodySchema = z.object({
  contextHtml: z.string().min(1),
  currentText: z.string().optional(),
  suggestionType: z.enum([
    "next_paragraph",
    "improve_flow",
    "add_details",
    "strengthen_opening",
    "better_conclusion",
    "enhance_dialogue",
    "add_transitions",
    "vary_sentences"
  ]),
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

    const { contextHtml, currentText, suggestionType, storyId } = parsed.data;

    const model = google("gemini-2.0-flash");

    // Convert HTML to plain text for analysis
    const plainTextContext = contextHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let prompt = "";

    switch (suggestionType) {
      case "next_paragraph":
        prompt = `You are a creative writing assistant for blog stories.
Based on the story context, suggest 2-3 different directions for the next paragraph.
Each suggestion should be a brief description (1-2 sentences) of what could come next.
Make them varied and engaging options that would naturally follow the current content.

Story context:
${plainTextContext}

Current text being worked on:
${currentText ?? "(at the end of the story)"}

Provide 3 distinct suggestions for what could come next. Format as a simple list.`;
        break;

      case "improve_flow":
        prompt = `You are a writing flow specialist for blog stories.
Analyze the story and suggest 2-3 specific ways to improve the flow and transitions.
Focus on connecting ideas better, varying sentence structure, and creating smoother reading experience.

Story context:
${plainTextContext}

Provide 3 specific suggestions for improving flow. Format as a simple list.`;
        break;

      case "add_details":
        prompt = `You are a descriptive writing specialist for blog stories.
Analyze the story and suggest 2-3 specific places where adding more details would enhance the narrative.
Focus on sensory details, character development, or scene setting that would make the story more vivid.

Story context:
${plainTextContext}

Provide 3 specific suggestions for adding details. Format as a simple list.`;
        break;

      case "strengthen_opening":
        prompt = `You are a story opening specialist for blog stories.
Analyze the beginning of this story and suggest 2-3 ways to make the opening more compelling and engaging.
Focus on hooks, setting the scene, or drawing the reader in more effectively.

Story context:
${plainTextContext}

Provide 3 specific suggestions for strengthening the opening. Format as a simple list.`;
        break;

      case "better_conclusion":
        prompt = `You are a story conclusion specialist for blog stories.
Analyze this story and suggest 2-3 ways to create a more satisfying and impactful conclusion.
Focus on tying up loose ends, leaving a lasting impression, or providing meaningful closure.

Story context:
${plainTextContext}

Provide 3 specific suggestions for improving the conclusion. Format as a simple list.`;
        break;

      case "enhance_dialogue":
        prompt = `You are a dialogue writing specialist for blog stories.
Analyze the story and suggest 2-3 ways to improve any dialogue or add dialogue where it would enhance the narrative.
Focus on making conversations more natural, revealing character, or advancing the plot.

Story context:
${plainTextContext}

Provide 3 specific suggestions for enhancing dialogue. Format as a simple list.`;
        break;

      case "add_transitions":
        prompt = `You are a transition writing specialist for blog stories.
Analyze the story and suggest 2-3 places where better transitions would improve the narrative flow.
Focus on connecting paragraphs, scenes, or ideas more smoothly.

Story context:
${plainTextContext}

Provide 3 specific suggestions for adding or improving transitions. Format as a simple list.`;
        break;

      case "vary_sentences":
        prompt = `You are a sentence structure specialist for blog stories.
Analyze the story and suggest 2-3 ways to vary sentence structure and rhythm for better readability.
Focus on mixing short and long sentences, different sentence types, and improving overall rhythm.

Story context:
${plainTextContext}

Provide 3 specific suggestions for varying sentence structure. Format as a simple list.`;
        break;

      default:
        return NextResponse.json({ error: "Invalid suggestion type" }, { status: 400 });
    }

    const { text: suggestions } = await generateText({ model, prompt });

    // Parse suggestions into an array
    const suggestionList = suggestions
      .split('\n')
      .map(s => s.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '').trim())
      .filter(s => s.length > 0)
      .slice(0, 3); // Ensure we only return 3 suggestions

    return NextResponse.json({
      suggestions: suggestionList,
      suggestionType
    });

  } catch (e: any) {
    console.error("Blog suggestions error:", e);
    return NextResponse.json(
      { error: e?.message || "Suggestions generation failed" },
      { status: 500 }
    );
  }
}