import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users, generationJobs, stories } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const jobType = searchParams.get('jobType');

    // Build query with filters
    let queryBuilder = db
      .select({
        job: generationJobs,
        story: {
          id: stories.id,
          title: stories.title,
          ownerId: stories.ownerId,
        },
      })
      .from(generationJobs)
      .leftJoin(stories, eq(generationJobs.storyId, stories.id))
      .$dynamic();

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.where(eq(generationJobs.status, status as any));
    }
    if (jobType) {
      queryBuilder = queryBuilder.where(eq(generationJobs.jobType, jobType as any));
    }

    const jobs = await queryBuilder
      .orderBy(desc(generationJobs.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        ...j.job,
        story: j.story,
      })),
      pagination: {
        limit,
        offset,
        hasMore: jobs.length === limit,
      },
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
