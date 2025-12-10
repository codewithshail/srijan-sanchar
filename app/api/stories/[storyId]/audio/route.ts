/**
 * Audio Chapters API
 * 
 * GET /api/stories/[storyId]/audio - Get audio chapters for a story
 * POST /api/stories/[storyId]/audio - Generate audio chapters for a story
 * DELETE /api/stories/[storyId]/audio - Delete audio chapters for a story
 * 
 * Requirements: 8.2, 8.3
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stories, users, generationJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { audioChapterService } from "@/lib/audio/audio-chapter-service";
import { JobQueue, JobType } from "@/lib/jobs";
import { z } from "zod";

/**
 * GET /api/stories/[storyId]/audio
 * Get audio chapters for a story
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") || undefined;

    // Verify story exists
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Get audio chapters
    const chapters = await audioChapterService.getChapters(storyId, language);

    // Get available languages for this story
    const allChapters = await audioChapterService.getChapters(storyId);
    const availableLanguages = [...new Set(allChapters.map(ch => ch.language))];

    // Calculate total duration
    const totalDuration = chapters.reduce((sum, ch) => sum + ch.duration, 0);

    return NextResponse.json({
      storyId,
      chapters,
      totalChapters: chapters.length,
      totalDuration,
      language: language || (chapters.length > 0 ? chapters[0].language : null),
      availableLanguages,
      supportedLanguages: audioChapterService.getAvailableLanguages(),
    });
  } catch (error) {
    console.error("Error fetching audio chapters:", error);
    return NextResponse.json(
      { error: "Failed to fetch audio chapters" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stories/[storyId]/audio
 * Generate audio chapters for a story
 */
const generateSchema = z.object({
  language: z.string().default("en-IN"),
  speaker: z.string().default("anushka"),
  targetDuration: z.number().min(30).max(300).default(60),
  pitch: z.number().min(-20).max(20).optional(),
  pace: z.number().min(0.25).max(4.0).optional(),
  async: z.boolean().default(true), // Use background job by default
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;

    // Verify user owns the story
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!story.content) {
      return NextResponse.json(
        { error: "Story has no content to generate audio from" },
        { status: 400 }
      );
    }

    // Parse request body
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine, use defaults
    }

    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const config = parsed.data;

    // Validate language
    if (!audioChapterService.isLanguageSupported(config.language)) {
      return NextResponse.json(
        { 
          error: `Language ${config.language} is not supported`,
          supportedLanguages: audioChapterService.getAvailableLanguages(),
        },
        { status: 400 }
      );
    }

    if (config.async) {
      // Create background job for audio generation
      const [job] = await db
        .insert(generationJobs)
        .values({
          storyId,
          jobType: "audio_generation",
          status: "pending",
          config: {
            language: config.language,
            speaker: config.speaker,
            targetDuration: config.targetDuration,
            pitch: config.pitch,
            pace: config.pace,
          },
        })
        .returning();

      // Add to job queue
      await JobQueue.addJob(JobType.AUDIO_GENERATION, {
        storyId,
        config: {
          language: config.language,
          speaker: config.speaker,
          targetDuration: config.targetDuration,
          pitch: config.pitch,
          pace: config.pace,
        },
      });

      return NextResponse.json({
        message: "Audio generation started",
        jobId: job.id,
        storyId,
        config: {
          language: config.language,
          speaker: config.speaker,
          targetDuration: config.targetDuration,
        },
      });
    } else {
      // Synchronous generation (for smaller stories)
      const result = await audioChapterService.generateAllChapters(storyId, {
        language: config.language,
        speaker: config.speaker,
        targetDuration: config.targetDuration,
        pitch: config.pitch,
        pace: config.pace,
      });

      if (!result.success) {
        return NextResponse.json(
          { 
            error: "Failed to generate audio chapters",
            failedChapters: result.failedChapters,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: "Audio generation complete",
        storyId,
        chapters: result.chapters,
        totalChapters: result.chapters.length,
        totalDuration: result.totalDuration,
        language: result.language,
        speaker: result.speaker,
        failedChapters: result.failedChapters,
      });
    }
  } catch (error) {
    console.error("Error generating audio chapters:", error);
    return NextResponse.json(
      { error: "Failed to generate audio chapters" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/stories/[storyId]/audio
 * Delete audio chapters for a story
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { storyId } = await params;
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") || undefined;

    // Verify user owns the story
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.ownerId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete audio chapters
    await audioChapterService.deleteChapters(storyId, language);

    return NextResponse.json({
      message: language 
        ? `Audio chapters for language ${language} deleted`
        : "All audio chapters deleted",
      storyId,
      language,
    });
  } catch (error) {
    console.error("Error deleting audio chapters:", error);
    return NextResponse.json(
      { error: "Failed to delete audio chapters" },
      { status: 500 }
    );
  }
}
