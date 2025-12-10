import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stories, generationJobs, images } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { JobQueue, JobType } from "@/lib/jobs";
import { geminiService } from "@/lib/ai";

/**
 * Image generation configuration
 */
interface ImageGenerationConfig {
  numberOfImages?: number;
  imageStyle?: 'realistic' | 'artistic' | 'minimalist';
  aspectRatio?: '16:9' | '4:3' | '1:1';
  targetAudience?: 'children' | 'adults' | 'all';
  optimizeForPrint?: boolean;
  generateThumbnails?: boolean;
}

// POST /api/stories/[storyId]/images - Trigger image generation for a story
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

    // Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    if (!story.content) {
      return NextResponse.json(
        { error: "Story has no content to generate images from" },
        { status: 400 }
      );
    }

    // Check if there's already an image generation job in progress
    const existingJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, "image_generation")
      ),
      orderBy: [desc(generationJobs.createdAt)],
    });

    if (existingJob && ["pending", "processing"].includes(existingJob.status)) {
      return NextResponse.json(
        {
          error: "Image generation already in progress",
          jobId: existingJob.id,
          status: existingJob.status,
        },
        { status: 409 }
      );
    }

    // Parse configuration from request body
    const body = await request.json().catch(() => ({}));
    const config: ImageGenerationConfig = {
      numberOfImages: Math.min(body.numberOfImages || 3, 10), // Max 10 images
      imageStyle: body.imageStyle || 'realistic',
      aspectRatio: body.aspectRatio || '16:9',
      targetAudience: body.targetAudience || 'adults',
      optimizeForPrint: body.optimizeForPrint || false,
      generateThumbnails: body.generateThumbnails !== false,
    };

    // Create job record in database
    const [jobRecord] = await db
      .insert(generationJobs)
      .values({
        storyId,
        jobType: "image_generation",
        status: "pending",
        config: config as Record<string, unknown>,
      })
      .returning();

    // Add job to queue
    let queueJobId: string;
    try {
      queueJobId = await JobQueue.addJob(JobType.IMAGE_GENERATION, {
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

      console.error("[IMAGE_GENERATION_API] Queue error:", queueError);
      return NextResponse.json(
        { error: "Failed to queue image generation" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Image generation started",
      jobId: jobRecord.id,
      queueJobId,
      config,
    });
  } catch (error) {
    console.error("[IMAGE_GENERATION_API_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// GET /api/stories/[storyId]/images - Get images for a story
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

    // Verify story ownership or public access
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    // Check access - owner or published story
    const isOwner = story.ownerId === user.id;
    const isPublished = story.status === "published";

    if (!isOwner && !isPublished) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get image metadata
    const storyImage = await db.query.images.findFirst({
      where: eq(images.storyId, storyId),
    });

    // Get latest image generation job
    const latestJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, "image_generation")
      ),
      orderBy: [desc(generationJobs.createdAt)],
    });

    // Extract images from job result if available
    const jobImages = latestJob?.result && typeof latestJob.result === 'object'
      ? (latestJob.result as { images?: unknown[] }).images || []
      : [];

    return NextResponse.json({
      storyId,
      bannerImageUrl: story.bannerImageUrl,
      thumbnailImageUrl: story.thumbnailImageUrl,
      primaryImage: storyImage
        ? {
            url: storyImage.url,
            prompt: storyImage.prompt,
            createdAt: storyImage.createdAt,
          }
        : null,
      generatedImages: jobImages,
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
    });
  } catch (error) {
    console.error("[GET_IMAGES_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// DELETE /api/stories/[storyId]/images - Delete images for a story
export async function DELETE(
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

    // Delete image metadata
    await db.delete(images).where(eq(images.storyId, storyId));

    // Clear image URLs from story
    await db
      .update(stories)
      .set({
        bannerImageUrl: null,
        thumbnailImageUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    // Note: Cloudinary cleanup would be handled separately
    // cloudinaryService.deleteStoryAssets(storyId) could be called here

    return NextResponse.json({
      success: true,
      message: "Images deleted successfully",
    });
  } catch (error) {
    console.error("[DELETE_IMAGES_ERROR]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
