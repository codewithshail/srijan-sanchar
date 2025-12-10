import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { generationJobs, stories, users } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { JobQueue, JobType } from '@/lib/jobs';

/**
 * GET /api/stories/[storyId]/jobs - Get all jobs for a story
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storyId } = await params;

    // Verify user owns the story or is admin
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId));

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check story ownership
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    if (story.ownerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all jobs for this story from database
    const jobs = await db
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.storyId, storyId))
      .orderBy(desc(generationJobs.createdAt));

    // Enrich with queue status where available
    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        try {
          const queueDetails = await JobQueue.getJobDetails(
            job.jobType as JobType,
            job.id
          );

          if (queueDetails) {
            return {
              ...job,
              queueStatus: queueDetails.status,
              queueProgress: queueDetails.progress,
              attemptsMade: queueDetails.attemptsMade,
              maxAttempts: queueDetails.maxAttempts,
              processedOn: queueDetails.processedOn,
              finishedOn: queueDetails.finishedOn,
            };
          }
        } catch {
          // Queue lookup failed, return database info only
        }

        return {
          ...job,
          queueStatus: job.status,
          queueProgress: job.status === 'completed' ? 100 : 0,
        };
      })
    );

    // Group by job type
    const groupedJobs = {
      storyGeneration: enrichedJobs.filter(j => j.jobType === 'story_generation'),
      imageGeneration: enrichedJobs.filter(j => j.jobType === 'image_generation'),
      audioGeneration: enrichedJobs.filter(j => j.jobType === 'audio_generation'),
    };

    // Get latest job of each type
    const latestJobs = {
      storyGeneration: groupedJobs.storyGeneration[0] || null,
      imageGeneration: groupedJobs.imageGeneration[0] || null,
      audioGeneration: groupedJobs.audioGeneration[0] || null,
    };

    // Check if any job is in progress
    const isProcessing = enrichedJobs.some(
      j => j.status === 'pending' || j.status === 'processing'
    );

    return NextResponse.json({
      storyId,
      jobs: enrichedJobs,
      groupedJobs,
      latestJobs,
      isProcessing,
      totalJobs: enrichedJobs.length,
    });
  } catch (error) {
    console.error('Error fetching story jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
