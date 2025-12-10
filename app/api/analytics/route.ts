import { db } from "@/lib/db";
import { stories, storyAnalytics, users } from "@/lib/db/schema";
import { eq, sql, and, count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get user's stories with analytics summary
        const userStories = await db
            .select({
                id: stories.id,
                title: stories.title,
                storyType: stories.storyType,
                status: stories.status,
                viewCount: stories.viewCount,
                listenCount: stories.listenCount,
                publishedAt: stories.publishedAt,
                createdAt: stories.createdAt,
            })
            .from(stories)
            .innerJoin(users, eq(stories.ownerId, users.id))
            .where(eq(users.clerkId, userId))
            .orderBy(desc(stories.updatedAt));

        // Get total engagement metrics for user
        const totalEngagement = await db
            .select({
                totalViews: sql<number>`COALESCE(SUM(${stories.viewCount}), 0)`,
                totalListens: sql<number>`COALESCE(SUM(${stories.listenCount}), 0)`,
                totalShares: sql<number>`COALESCE(SUM(${stories.shareCount}), 0)`,
                publishedCount: sql<number>`COUNT(CASE WHEN ${stories.status} = 'published' THEN 1 END)`,
                totalStories: sql<number>`COUNT(*)`,
            })
            .from(stories)
            .innerJoin(users, eq(stories.ownerId, users.id))
            .where(eq(users.clerkId, userId));

        // Get recent activity (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentActivity = await db
            .select({
                date: sql<string>`DATE(${storyAnalytics.createdAt})`,
                eventType: storyAnalytics.eventType,
                count: count(),
            })
            .from(storyAnalytics)
            .innerJoin(stories, eq(storyAnalytics.storyId, stories.id))
            .innerJoin(users, eq(stories.ownerId, users.id))
            .where(
                and(
                    eq(users.clerkId, userId),
                    sql`${storyAnalytics.createdAt} >= ${sevenDaysAgo}`
                )
            )
            .groupBy(
                sql`DATE(${storyAnalytics.createdAt})`,
                storyAnalytics.eventType
            )
            .orderBy(sql`DATE(${storyAnalytics.createdAt})`);

        // Get language preferences across all user stories
        const languagePreferences = await db
            .select({
                languageCode: storyAnalytics.languageCode,
                count: count(),
            })
            .from(storyAnalytics)
            .innerJoin(stories, eq(storyAnalytics.storyId, stories.id))
            .innerJoin(users, eq(stories.ownerId, users.id))
            .where(
                and(
                    eq(users.clerkId, userId),
                    eq(storyAnalytics.eventType, 'listen')
                )
            )
            .groupBy(storyAnalytics.languageCode);

        return NextResponse.json({
            stories: userStories,
            totalEngagement: totalEngagement[0],
            recentActivity,
            languagePreferences,
        });
    } catch (error) {
        console.error("[USER_ANALYTICS_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}