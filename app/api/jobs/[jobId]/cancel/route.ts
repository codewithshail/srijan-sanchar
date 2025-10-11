import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { generationJobs } from '@/lib/db/schema';
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

    // Cancel job in queue
    await JobQueue.cancelJob(job.jobType as JobType, jobId);

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'failed',
        error: 'Cancelled by user',
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, jobId));

    return NextResponse.json({
      success: true,
      message: 'Job cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    );
  }
}
