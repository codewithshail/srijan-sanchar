import { db } from "@/lib/db";
import { stories, storyAnalytics, comments, likes } from "@/lib/db/schema";
import { eq, sql, desc, and, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ storyId: string }> }
) {
    try {
        const { eventType, languageCode } = await request.json();
        const { storyId } = await params;

        // Validate event type
        if (!['view', 'listen', 'share'].includes(eventType)) {
            return new NextResponse("Invalid event type", { status: 400 });
        }

        // Check if story exists and is published
        const story = await db.query.stories.findFirst({
            where: eq(stories.id, storyId),
            columns: { id: true, status: true }
        });

        if (!story) {
            return new NextResponse("Story not found", { status: 404 });
        }

        if (story.status !== 'published') {
            return new NextResponse("Story not published", { status: 403 });
        }

        // Record the analytics event
        await db.insert(storyAnalytics).values({
            storyId,
            eventType,
            languageCode: languageCode || null,
        });

        // Update the corresponding counter in the stories table
        if (eventType === 'view') {
            await db
                .update(stories)
                .set({ 
                    viewCount: sql`${stories.viewCount} + 1` 
                })
                .where(eq(stories.id, storyId));
        } else if (eventType === 'listen') {
            await db
                .update(stories)
                .set({ 
                    listenCount: sql`${stories.listenCount} + 1` 
                })
                .where(eq(stories.id, storyId));
        } else if (eventType === 'share') {
            await db
                .update(stories)
                .set({ 
                    shareCount: sql`${stories.shareCount} + 1` 
                })
                .where(eq(stories.id, storyId));
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[STORY_ANALYTICS_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ storyId: string }> }
) {
    try {
        const { userId } = await auth();
        const { storyId } = await params;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Check if user owns the story
        const story = await db.query.stories.findFirst({
            where: eq(stories.id, storyId),
            columns: { 
                id: true, 
                ownerId: true, 
                viewCount: true, 
                listenCount: true,
                shareCount: true,
                title: true,
                publishedAt: true,
                status: true
            },
            with: {
                owner: {
                    columns: { clerkId: true }
                }
            }
        });

        if (!story) {
            return new NextResponse("Story not found", { status: 404 });
        }

        const ownerClerkId = Array.isArray(story.owner) ? story.owner[0]?.clerkId : story.owner.clerkId;
        if (ownerClerkId !== userId) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Get detailed analytics data
        const analyticsData = await db
            .select({
                eventType: storyAnalytics.eventType,
                languageCode: storyAnalytics.languageCode,
                createdAt: storyAnalytics.createdAt,
            })
            .from(storyAnalytics)
            .where(eq(storyAnalytics.storyId, storyId))
            .orderBy(desc(storyAnalytics.createdAt));

        // Get language preferences summary
        const languageStats = await db
            .select({
                languageCode: storyAnalytics.languageCode,
                count: count(),
            })
            .from(storyAnalytics)
            .where(
                and(
                    eq(storyAnalytics.storyId, storyId),
                    eq(storyAnalytics.eventType, 'listen')
                )
            )
            .groupBy(storyAnalytics.languageCode);

        // Get daily engagement stats for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyStats = await db
            .select({
                date: sql<string>`DATE(${storyAnalytics.createdAt})`,
                eventType: storyAnalytics.eventType,
                count: count(),
            })
            .from(storyAnalytics)
            .where(
                and(
                    eq(storyAnalytics.storyId, storyId),
                    sql`${storyAnalytics.createdAt} >= ${thirtyDaysAgo}`
                )
            )
            .groupBy(
                sql`DATE(${storyAnalytics.createdAt})`,
                storyAnalytics.eventType
            )
            .orderBy(sql`DATE(${storyAnalytics.createdAt})`);

        // Get comment count
        const commentCountResult = await db
            .select({ count: count() })
            .from(comments)
            .where(eq(comments.storyId, storyId));
        
        const commentCount = commentCountResult[0]?.count || 0;

        // Get like count
        const likeCountResult = await db
            .select({ count: count() })
            .from(likes)
            .where(eq(likes.storyId, storyId));
        
        const likeCount = likeCountResult[0]?.count || 0;

        return NextResponse.json({
            story: {
                id: story.id,
                title: story.title,
                viewCount: story.viewCount,
                listenCount: story.listenCount,
                shareCount: story.shareCount,
                commentCount,
                likeCount,
                publishedAt: story.publishedAt,
                status: story.status,
            },
            analytics: analyticsData,
            languagePreferences: languageStats,
            dailyEngagement: dailyStats,
        });
    } catch (error) {
        console.error("[STORY_ANALYTICS_GET_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}