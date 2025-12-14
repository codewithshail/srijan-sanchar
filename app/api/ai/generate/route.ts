import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { db } from "@/lib/db" // Adjust path to your db instance
import { stories, summaries } from "@/lib/db/schema" // Adjust path to your schema
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

// Schema for wizard-based generation
const wizardSchema = z.object({
  mode: z.enum(["summary", "full"]),
  title: z.string().min(1).max(200),
  stages: z
    .array(
      z.object({
        range: z.string(),
        selections: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1),
})

// Schema for editor-based generation
const editorSchema = z.object({
  storyId: z.string().min(1),
  mode: z.literal("ai"),
  storyType: z.enum(["summary", "full"]),
  title: z.string().min(1).max(200),
  contentHtml: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()

    // Try to parse as editor request first
    const editorParsed = editorSchema.safeParse(body)
    if (editorParsed.success) {
      return handleEditorGeneration(editorParsed.data)
    }

    // Try to parse as wizard request
    const wizardParsed = wizardSchema.safeParse(body)
    if (wizardParsed.success) {
      return handleWizardGeneration(wizardParsed.data)
    }

    console.error("Schema validation failed:", body)
    return NextResponse.json({ error: "Invalid input format" }, { status: 400 })

  } catch (err: any) {
    console.error("API error:", err)
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    )
  }
}

async function handleEditorGeneration(data: z.infer<typeof editorSchema>) {
  const { storyId, storyType, title, contentHtml } = data

  try {
    // Verify story ownership
    const existingStory = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1)

    if (existingStory.length === 0) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 })
    }

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!key) return NextResponse.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" }, { status: 500 })

    const model = google(storyType === "summary" ? "gemini-2.0-flash" : "gemini-1.5-pro")

    // Convert HTML to plain text for better AI processing
    const plainTextContent = contentHtml
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    const prompt = `
You are a compassionate biographical storyteller and editor.

Title: ${title}

Current content:
${plainTextContent || "No content provided yet - please create from the title."}

Task: ${storyType === "summary"
        ? "Create a polished, well-structured summary that improves grammar, clarity, and flow while preserving the core message. Keep it concise but meaningful (2-4 paragraphs)."
        : "Expand this into a complete, engaging story of 800-1500 words with clear structure, vivid details, and emotional depth."}

Requirements:
- Use clear headings and subheadings where appropriate  
- Maintain a warm, personal tone
- Ensure proper grammar and flow
- ${storyType === "summary" ? "Keep it concise but meaningful" : "Add rich details and expand on key moments"}
- Return formatted text (you can use markdown formatting)

Return only the story content, no additional commentary.
`

    const { text } = await generateText({ model, prompt })

    // Convert markdown to HTML for consistency
    const htmlContent = text
      .split('\n')
      .map(line => {
        if (line.startsWith('### ')) return `<h3>${line.replace(/^### /, '')}</h3>`
        if (line.startsWith('## ')) return `<h2>${line.replace(/^## /, '')}</h2>`
        if (line.startsWith('# ')) return `<h1>${line.replace(/^# /, '')}</h1>`
        if (line.trim() === '') return ''
        return `<p>${line}</p>`
      })
      .join('\n')

    // Generate actionable steps
    const stepsPrompt = `Based on this life story, provide 3-5 actionable steps for personal growth and reflection:

Story: ${text}

Return only a simple list of actionable steps, one per line, without numbers or bullets.`

    const stepsResult = await generateText({ model: google("gemini-2.0-flash"), prompt: stepsPrompt })
    const actionableSteps = stepsResult.text.split('\n').filter(step => step.trim().length > 0)

    // Generate psychological summary
    const psyPrompt = `As a compassionate counselor, provide a brief psychological insight about this person's journey and growth:

Story: ${text}

Provide 2-3 sentences focusing on resilience, growth patterns, or positive psychological insights.`

    const psyResult = await generateText({ model: google("gemini-2.0-flash"), prompt: psyPrompt })

    // Create the complete summary object
    const summary = {
      userSummary: storyType === "summary" ? text : plainTextContent,
      psySummary: psyResult.text,
      actionableSteps,
      longFormStory: storyType === "full" ? text : undefined
    }

    return NextResponse.json({
      success: true,
      storyId,
      summary,
      generatedContent: htmlContent
    })

  } catch (err: any) {
    console.error("AI generation failed:", err)
    return NextResponse.json(
      {
        error: err?.message || "Failed to generate story content"
      },
      { status: 500 }
    )
  }
}

async function handleWizardGeneration(data: z.infer<typeof wizardSchema>) {
  // Your existing wizard logic here
  const { mode, title, stages } = data
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) return NextResponse.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" }, { status: 500 })

  const model = google(mode === "summary" ? "gemini-2.0-flash" : "gemini-1.5-pro")
  const prompt = `
You are a compassionate biographical storyteller.

Title: ${title}

Seven life stages (age range, selected events, notes):
${stages
      .map(
        (s, i) =>
          `${i + 1}. ${s.range}
   Selected: ${(s.selections || []).join("; ") || "—"}
   Notes: ${s.notes || "—"}`,
      )
      .join("\n")}

Write a ${mode === "summary" ? "concise 2-4 paragraph summary" : "complete, engaging story of 800-1500 words"}.
Use clear headings and subheadings where appropriate. Preserve chronology and connective emotional insights.
`

  try {
    const { text } = await generateText({ model, prompt })
    return NextResponse.json({ text, mode })
  } catch (err: any) {
    return NextResponse.json(
      {
        text: "We couldn't reach AI right now. Here's a safe outline to start:\n\n# Introduction\n- Early years\n- Family background\n\n# Growth\n- School memories\n- Friendships\n\n# Challenges\n- Turning points\n\n# Present\n- Lessons learned\n\n# Future\n- Hopes and aspirations",
        mode: "summary",
        error: err?.message || "Unknown error",
      },
      { status: 200 },
    )
  }
}