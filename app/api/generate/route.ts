import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db" // Adjust path to your db instance
import { stories, summaries } from "@/lib/db/schema" // Adjust path to your schema
import { eq } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"

const bodySchema = z.object({
  storyId: z.string().min(1),
  mode: z.enum(["as-is", "ai-enhanced"]),
  title: z.string().min(1).max(200),
  contentHtml: z.string(),
  summary: z.object({
    userSummary: z.string(),
    psySummary: z.string(),
    actionableSteps: z.array(z.string()),
    longFormStory: z.string().optional(),
  }).optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const parsed = bodySchema.safeParse(await req.json())
    if (!parsed.success) {
      console.error("Validation error:", parsed.error)
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const { storyId, mode, title, contentHtml, summary: providedSummary } = parsed.data

    // Verify story ownership
    const existingStory = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId))
      .limit(1)

    if (existingStory.length === 0) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 })
    }

    // Convert HTML to plain text for better processing
    const plainTextContent = contentHtml
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()

    // Create a story summary object based on the mode
    let summaryData
    if (mode === "as-is") {
      // Save as-is without AI enhancement
      summaryData = {
        userSummary: plainTextContent || "No content provided",
        psySummary: "This story was saved as written by the user.",
        actionableSteps: [
          "Reflect on your experiences and what you've learned",
          "Consider sharing your story with trusted friends or family", 
          "Think about how your experiences can guide future decisions"
        ],
        longFormStory: contentHtml || null // Keep the original HTML formatting
      }
    } else {
      // For AI enhanced, use the provided summary
      if (!providedSummary) {
        return NextResponse.json({ error: "AI summary data is required for ai-enhanced mode" }, { status: 400 })
      }
      summaryData = {
        userSummary: providedSummary.userSummary,
        psySummary: providedSummary.psySummary,
        actionableSteps: providedSummary.actionableSteps,
        longFormStory: providedSummary.longFormStory || null
      }
    }

    // Start database transaction
    await db.transaction(async (tx) => {
      // Update story title and status
      await tx
        .update(stories)
        .set({ 
          title: title.trim(),
          status: "completed",
          updatedAt: new Date()
        })
        .where(eq(stories.id, storyId))

      // Check if summary already exists
      const existingSummary = await tx
        .select()
        .from(summaries)
        .where(eq(summaries.storyId, storyId))
        .limit(1)

      if (existingSummary.length > 0) {
        // Update existing summary
        await tx
          .update(summaries)
          .set({
            userSummary: summaryData.userSummary,
            psySummary: summaryData.psySummary,
            actionableSteps: summaryData.actionableSteps,
            longFormStory: summaryData.longFormStory,
          })
          .where(eq(summaries.storyId, storyId))
      } else {
        // Create new summary
        await tx
          .insert(summaries)
          .values({
            storyId,
            userSummary: summaryData.userSummary,
            psySummary: summaryData.psySummary,
            actionableSteps: summaryData.actionableSteps,
            longFormStory: summaryData.longFormStory,
          })
      }
    })

    return NextResponse.json({ 
      success: true, 
      storyId,
      message: `Story ${mode === "as-is" ? "saved" : "generated"} successfully`
    })
    
  } catch (err: any) {
    console.error("Story generation error:", err)
    return NextResponse.json(
      { error: err?.message || "Failed to process story" },
      { status: 500 }
    )
  }
}