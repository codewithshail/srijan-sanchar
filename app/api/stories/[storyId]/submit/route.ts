import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stories, storyStages, generationJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { LIFE_STAGES } from "@/lib/life-stages";
import { JobQueue, JobType } from "@/lib/jobs";

// Minimum content requirements
const MIN_CONTENT_LENGTH = 50; // Minimum characters per stage
const MIN_STAGES_REQUIRED = 1; // At least one stage must have content

export interface SubmissionConfig {
  includeAIImages?: boolean;
  numberOfPages?: number;
  improveGrammar?: boolean;
  tone?: "formal" | "casual" | "poetic" | "narrative";
  targetAudience?: "children" | "adults" | "all";
  imageStyle?: "realistic" | "artistic" | "minimalist";
}

interface SubmissionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stagesWithContent: number;
  totalStages: number;
  totalContentLength: number;
}

/**
 * Validate story stages for submission
 */
function validateStagesForSubmission(
  stages: { stageName: string; content: string | null }[]
): SubmissionValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let stagesWithContent = 0;
  let totalContentLength = 0;

  for (const stage of stages) {
    const content = stage.content?.trim() || "";
    if (content.length > 0) {
      stagesWithContent++;
      totalContentLength += content.length;

      if (content.length < MIN_CONTENT_LENGTH) {
        warnings.push(
          `Stage "${stage.stageName}" has minimal content (${content.length} characters). Consider adding more details.`
        );
      }
    }
  }

  if (stagesWithContent < MIN_STAGES_REQUIRED) {
    errors.push(
      `At least ${MIN_STAGES_REQUIRED} stage(s) must have content to submit your story.`
    );
  }

  if (totalContentLength < MIN_CONTENT_LENGTH) {
    errors.push(
      `Total content is too short. Please add more details to your story.`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stagesWithContent,
    totalStages: LIFE_STAGES.length,
    totalContentLength,
  };
}

// POST /api/stories/[storyId]/submit - Submit life story for generation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify story ownership and type
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (story.storyType !== "life_story") {
      return NextResponse.json(
        { error: "This endpoint is only for life stories" },
        { status: 400 }
      );
    }

    // Check if story is already being processed
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
          error: "Story is already being processed",
          jobId: existingJob.id,
          status: existingJob.status,
        },
        { status: 409 }
      );
    }

    // Get all stages for this story
    const stages = await db.query.storyStages.findMany({
      where: eq(storyStages.storyId, storyId),
      orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
    });

    // Validate stages
    const validation = validateStagesForSubmission(stages);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          validation,
        },
        { status: 400 }
      );
    }

    // Parse submission config from request body
    const body = await request.json().catch(() => ({}));
    const config: SubmissionConfig = {
      includeAIImages: body.includeAIImages ?? false,
      numberOfPages: body.numberOfPages ?? 12,
      improveGrammar: body.improveGrammar ?? true,
      tone: body.tone ?? "narrative",
      targetAudience: body.targetAudience ?? "adults",
      imageStyle: body.imageStyle ?? "artistic",
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

      console.error("[SUBMIT_STORY] Queue error:", queueError);
      return NextResponse.json(
        { error: "Failed to queue story generation" },
        { status: 500 }
      );
    }

    // Update story status to indicate it's being processed
    await db
      .update(stories)
      .set({
        status: "draft", // Keep as draft until generation completes
        generationConfig: config as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    return NextResponse.json({
      success: true,
      message: "Story submitted for generation",
      jobId: jobRecord.id,
      queueJobId,
      validation,
      config,
    });
  } catch (error) {
    console.error("[SUBMIT_STORY_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// GET /api/stories/[storyId]/submit - Get submission status and validation
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

    // Get all stages for this story
    const stages = await db.query.storyStages.findMany({
      where: eq(storyStages.storyId, storyId),
      orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
    });

    // Validate stages
    const validation = validateStagesForSubmission(stages);

    // Get latest job status if any
    const latestJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, "story_generation")
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    return NextResponse.json({
      storyId,
      storyType: story.storyType,
      storyStatus: story.status,
      validation,
      latestJob: latestJob
        ? {
            id: latestJob.id,
            status: latestJob.status,
            config: latestJob.config,
            error: latestJob.error,
            createdAt: latestJob.createdAt,
            updatedAt: latestJob.updatedAt,
          }
        : null,
      canSubmit: validation.isValid && (!latestJob || !["pending", "processing"].includes(latestJob.status)),
    });
  } catch (error) {
    console.error("[GET_SUBMISSION_STATUS_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
