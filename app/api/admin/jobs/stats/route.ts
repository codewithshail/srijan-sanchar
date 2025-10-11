import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { JobQueue, JobType } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is admin
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId));

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get stats for all job types
    const [storyStats, imageStats, audioStats] = await Promise.all([
      JobQueue.getQueueStats(JobType.STORY_GENERATION),
      JobQueue.getQueueStats(JobType.IMAGE_GENERATION),
      JobQueue.getQueueStats(JobType.AUDIO_GENERATION),
    ]);

    return NextResponse.json({
      storyGeneration: storyStats,
      imageGeneration: imageStats,
      audioGeneration: audioStats,
      total: {
        waiting: storyStats.waiting + imageStats.waiting + audioStats.waiting,
        active: storyStats.active + imageStats.active + audioStats.active,
        completed: storyStats.completed + imageStats.completed + audioStats.completed,
        failed: storyStats.failed + imageStats.failed + audioStats.failed,
        delayed: storyStats.delayed + imageStats.delayed + audioStats.delayed,
      },
    });
  } catch (error) {
    console.error('Error fetching job stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job stats' },
      { status: 500 }
    );
  }
}
