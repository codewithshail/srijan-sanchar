import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { JobQueue, JobType } from '@/lib/jobs';

interface JobProgressInfo {
  progress: number;
  message?: string;
  stage?: string;
}

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

    // Get detailed job information from queue
    try {
      const jobDetails = await JobQueue.getJobDetails(
        job.jobType as JobType,
        jobId
      );

      if (jobDetails) {
        // Parse progress info if it's an object
        let progressInfo: JobProgressInfo = { progress: 0 };
        if (typeof jobDetails.progress === 'number') {
          progressInfo = { progress: jobDetails.progress };
        } else if (typeof jobDetails.progress === 'object') {
          progressInfo = jobDetails.progress as JobProgressInfo;
        }

        return NextResponse.json({
          jobId,
          storyId: job.storyId,
          jobType: job.jobType,
          status: jobDetails.status,
          progress: progressInfo.progress || 0,
          progressMessage: progressInfo.message,
          progressStage: progressInfo.stage,
          attemptsMade: jobDetails.attemptsMade,
          maxAttempts: jobDetails.maxAttempts,
          result: jobDetails.result || job.result,
          error: jobDetails.error || job.error,
          processedOn: jobDetails.processedOn,
          finishedOn: jobDetails.finishedOn,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        });
      }
    } catch (queueError) {
      // Queue error - fall through to database status
      console.warn('Queue status fetch failed:', queueError);
    }

    // If job not in queue or queue error, return database status
    // Parse result for progress info if available
    const result = job.result as Record<string, unknown> | null;
    
    return NextResponse.json({
      jobId,
      storyId: job.storyId,
      jobType: job.jobType,
      status: job.status,
      progress: job.status === 'completed' ? 100 : (job.status === 'failed' ? 0 : 0),
      progressMessage: job.status === 'completed' ? 'Complete' : (job.status === 'failed' ? 'Failed' : 'Pending'),
      attemptsMade: result?.attemptsMade as number || 0,
      maxAttempts: result?.maxAttempts as number || 3,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
