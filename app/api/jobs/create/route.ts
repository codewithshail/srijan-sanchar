import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { generationJobs, stories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { JobQueue, JobType } from '@/lib/jobs';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { storyId, jobType, config } = body;

    if (!storyId || !jobType) {
      return NextResponse.json(
        { error: 'Missing required fields: storyId, jobType' },
        { status: 400 }
      );
    }

    // Verify story exists and user owns it
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: 'Story not found' }, { status: 404 });
    }

    // Verify ownership
    const [owner] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate job type
    if (!Object.values(JobType).includes(jobType)) {
      return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
    }

    // Create job record in database
    const [jobRecord] = await db
      .insert(generationJobs)
      .values({
        storyId,
        jobType,
        status: 'pending',
        config: config || {},
      })
      .returning();

    // Add job to queue
    const jobId = await JobQueue.addJob(jobType as JobType, {
      storyId,
      config,
    });

    // Update job record with queue job ID
    await db
      .update(generationJobs)
      .set({ id: jobId })
      .where(eq(generationJobs.id, jobRecord.id));

    return NextResponse.json({
      success: true,
      jobId,
      jobType,
      storyId,
    });
  } catch (error) {
    console.error('Error creating job:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
