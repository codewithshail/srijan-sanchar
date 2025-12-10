import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { generationJobs, stories, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { JobQueue, JobType } from '@/lib/jobs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobId } = await params;

    // Fetch job from database
    const [job] = await db
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

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
      .where(eq(stories.id, job.storyId));

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    if (story.ownerId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow retrying failed jobs
    if (job.status !== 'failed') {
      return NextResponse.json(
        { error: 'Only failed jobs can be retried' },
        { status: 400 }
      );
    }

    // Try to retry the job in the queue
    const retried = await JobQueue.retryJob(job.jobType as JobType, jobId);

    if (retried) {
      // Update job status in database
      await db
        .update(generationJobs)
        .set({
          status: 'pending',
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(generationJobs.id, jobId));

      return NextResponse.json({
        success: true,
        message: 'Job queued for retry',
        jobId,
      });
    }

    // If job not in queue, create a new job
    const newJobId = await JobQueue.addJob(job.jobType as JobType, {
      storyId: job.storyId,
      config: job.config,
    });

    // Create new job record
    const [newJob] = await db
      .insert(generationJobs)
      .values({
        storyId: job.storyId,
        jobType: job.jobType,
        status: 'pending',
        config: job.config,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'New job created for retry',
      jobId: newJob.id,
      queueJobId: newJobId,
    });
  } catch (error) {
    console.error('Error retrying job:', error);
    return NextResponse.json(
      { error: 'Failed to retry job' },
      { status: 500 }
    );
  }
}
