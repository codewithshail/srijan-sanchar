import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stories, likes, comments, printOrders, users } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get total stories count
    const [storiesCount] = await db
      .select({ count: count() })
      .from(stories)
      .where(eq(stories.ownerId, user.id));

    // Get total views and listens across all stories
    const [viewsAndListens] = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${stories.viewCount}), 0)`,
        totalListens: sql<number>`COALESCE(SUM(${stories.listenCount}), 0)`,
      })
      .from(stories)
      .where(eq(stories.ownerId, user.id));

    // Get total likes across all user's stories
    const [likesCount] = await db
      .select({ count: count() })
      .from(likes)
      .innerJoin(stories, eq(likes.storyId, stories.id))
      .where(eq(stories.ownerId, user.id));

    // Get total comments across all user's stories
    const [commentsCount] = await db
      .select({ count: count() })
      .from(comments)
      .innerJoin(stories, eq(comments.storyId, stories.id))
      .where(eq(stories.ownerId, user.id));

    // Get print orders count
    const [ordersCount] = await db
      .select({ count: count() })
      .from(printOrders)
      .where(eq(printOrders.userId, user.id));

    return NextResponse.json({
      totalStories: storiesCount.count,
      totalViews: Number(viewsAndListens.totalViews),
      totalListens: Number(viewsAndListens.totalListens),
      totalLikes: likesCount.count,
      totalComments: commentsCount.count,
      totalPrintOrders: ordersCount.count,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
