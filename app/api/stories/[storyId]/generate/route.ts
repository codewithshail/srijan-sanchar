import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stories, storyStages, generationJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { JobQueue, JobType } from "@/lib/jobs";
import {
  checkRateLimit,
  recordRateLimitedRequest,
  getRateLimitErrorResponse
} from "@/lib/rate-limiting";

/**
 * Story generation configuration
 */
export interface StoryGenerationConfig {
  includeAIImages?: boolean;
  numberOfPages?: number;
  improveGrammar?: boolean;
  tone?: "formal" | "casual" | "poetic" | "narrative";
  targetAudience?: "children" | "adults" | "all";
  imageStyle?: "realistic" | "artistic" | "minimalist";
}

// POST /api/stories/[storyId]/generate - Trigger story generation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    // Check rate limit for heavy AI operations (story generation)
    const { allowed, result } = await checkRateLimit(request, "ai_heavy", "user");
    if (!allowed && result) {
      return getRateLimitErrorResponse(result);
    }

    const { storyId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Record the request after successful auth
    await recordRateLimitedRequest(request, "ai_heavy", "user");

    // Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Check if there's already a generation job in progress
    const existingJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, "story_generation")
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    if (existingJob && ["pending", "processing"].includes(existingJob.status)) {
      return NextResponse.json(
        {
          error: "Story generation already in progress",
          jobId: existingJob.id,
          status: existingJob.status,
        },
        { status: 409 }
      );
    }

    // Validate content exists
    let hasContent = false;

    if (story.storyType === "life_story") {
      // Check for stages
      const stages = await db.query.storyStages.findMany({
        where: eq(storyStages.storyId, storyId),
      });
      hasContent = stages.some((s) => s.content && s.content.trim().length > 0);
    } else {
      // Check for direct content
      hasContent = !!(story.content && story.content.trim().length > 0);
    }

    if (!hasContent) {
      return NextResponse.json(
        { error: "Story has no content to generate from" },
        { status: 400 }
      );
    }

    // Parse configuration from request body
    const body = await request.json().catch(() => ({}));
    const config: StoryGenerationConfig = {
      includeAIImages: body.includeAIImages ?? false,
      numberOfPages: Math.min(Math.max(body.numberOfPages || 12, 4), 24),
      improveGrammar: body.improveGrammar ?? true,
      tone: body.tone || "narrative",
      targetAudience: body.targetAudience || "adults",
      imageStyle: body.imageStyle || "artistic",
    };

    // Create job record in database
    const [jobRecord] = await db
      .insert(generationJobs)
      .values({
        storyId,
        jobType: "story_generation",
        status: "pending",
        config: config as Record<string, unknown>,
      })
      .returning();

    // Add job to queue
    let queueJobId: string;
    try {
      queueJobId = await JobQueue.addJob(JobType.STORY_GENERATION, {
        storyId,
        config,
        dbJobId: jobRecord.id, // Pass database job ID so worker can update the correct record
      });
    } catch (queueError) {
      // If queue fails, update job record to failed
      await db
        .update(generationJobs)
        .set({
          status: "failed",
          error: "Failed to add job to queue",
          updatedAt: new Date(),
        })
        .where(eq(generationJobs.id, jobRecord.id));

      console.error("[STORY_GENERATION_API] Queue error:", queueError);
      return NextResponse.json(
        { error: "Failed to queue story generation" },
        { status: 500 }
      );
    }

    // Update story to indicate generation is in progress
    await db
      .update(stories)
      .set({
        generationConfig: config as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return NextResponse.json({
      success: true,
      message: "Story generation started",
      jobId: jobRecord.id,
      queueJobId,
      config,
    });
  } catch (error) {
    console.error("[STORY_GENERATION_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// GET /api/stories/[storyId]/generate - Get generation status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Get latest generation job
    const latestJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, "story_generation")
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    // Get image generation job if any
    const imageJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, "image_generation")
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    return NextResponse.json({
      storyId,
      storyStatus: story.status,
      generationConfig: story.generationConfig,
      storyJob: latestJob
        ? {
          id: latestJob.id,
          status: latestJob.status,
          config: latestJob.config,
          result: latestJob.result,
          error: latestJob.error,
          createdAt: latestJob.createdAt,
          updatedAt: latestJob.updatedAt,
        }
        : null,
      imageJob: imageJob
        ? {
          id: imageJob.id,
          status: imageJob.status,
          config: imageJob.config,
          result: imageJob.result,
          error: imageJob.error,
          createdAt: imageJob.createdAt,
          updatedAt: imageJob.updatedAt,
        }
        : null,
      isGenerating:
        (latestJob && ["pending", "processing"].includes(latestJob.status)) ||
        (imageJob && ["pending", "processing"].includes(imageJob.status)),
    });
  } catch (error) {
    console.error("[GET_GENERATION_STATUS_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}


// PUT /api/stories/[storyId]/generate - Regenerate story with new configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Check if there's already a generation job in progress
    const existingJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, "story_generation")
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    if (existingJob && ["pending", "processing"].includes(existingJob.status)) {
      return NextResponse.json(
        {
          error: "Story generation already in progress",
          jobId: existingJob.id,
          status: existingJob.status,
        },
        { status: 409 }
      );
    }

    // Parse configuration from request body
    const body = await request.json().catch(() => ({}));
    const config: StoryGenerationConfig = {
      includeAIImages: body.includeAIImages ?? false,
      numberOfPages: Math.min(Math.max(body.numberOfPages || 12, 4), 24),
      improveGrammar: body.improveGrammar ?? true,
      tone: body.tone || "narrative",
      targetAudience: body.targetAudience || "adults",
      imageStyle: body.imageStyle || "artistic",
    };

    // Use the regenerateStory function from the processor
    const { regenerateStory } = await import("@/lib/jobs/processors/story-generation");
    const result = await regenerateStory(storyId, config);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, jobId: result.jobId },
        { status: result.jobId ? 409 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Story regeneration started",
      jobId: result.jobId,
      config,
    });
  } catch (error) {
    console.error("[STORY_REGENERATION_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
