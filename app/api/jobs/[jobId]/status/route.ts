import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { JobQueue, JobType } from '@/lib/jobs';

export async function GET(
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

    // Get real-time status from queue
    try {
      const queueStatus = await JobQueue.getJobStatus(
        job.jobType as JobType,
        jobId
      );

      return NextResponse.json({
        jobId,
        storyId: job.storyId,
        jobType: job.jobType,
        status: queueStatus.status,
        progress: queueStatus.progress || 0,
        result: queueStatus.result || job.result,
        error: queueStatus.error || job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    } catch (queueError) {
      // If job not in queue, return database status
      return NextResponse.json({
        jobId,
        storyId: job.storyId,
        jobType: job.jobType,
        status: job.status,
        progress: 0,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    }
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
