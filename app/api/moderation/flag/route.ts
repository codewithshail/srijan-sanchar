import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { contentFlags, users, stories, comments } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { contentModerationService } from "@/lib/moderation";

/**
 * POST /api/moderation/flag
 * Flag content for moderation review
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const body = await request.json();
    const { contentType, contentId, reason, description } = body as {
      contentType: 'story' | 'comment';
      contentId: string;
      reason: 'spam' | 'inappropriate' | 'harassment' | 'hate_speech' | 'violence' | 'misinformation' | 'copyright' | 'other';
      description?: string;
    };

    // Validate required fields
    if (!contentType || !['story', 'comment'].includes(contentType)) {
      return NextResponse.json(
        { error: "Valid contentType is required" },
        { status: 400 }
      );
    }

    if (!contentId) {
      return NextResponse.json(
        { error: "contentId is required" },
        { status: 400 }
      );
    }

    const validReasons = ['spam', 'inappropriate', 'harassment', 'hate_speech', 'violence', 'misinformation', 'copyright', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json(
        { error: "Valid reason is required" },
        { status: 400 }
      );
    }

    // Verify content exists
    if (contentType === 'story') {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, contentId),
      });
      if (!story) {
        return NextResponse.json(
          { error: "Story not found" },
          { status: 404 }
        );
      }
    } else {
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, contentId),
      });
      if (!comment) {
        return NextResponse.json(
          { error: "Comment not found" },
          { status: 404 }
        );
      }
    }

    // Check if user already flagged this content
    const existingFlag = await db.query.contentFlags.findFirst({
      where: and(
        eq(contentFlags.contentType, contentType),
        eq(contentFlags.contentId, contentId),
        eq(contentFlags.reporterId, user.id),
        eq(contentFlags.status, 'pending')
      ),
    });

    if (existingFlag) {
      return NextResponse.json(
        { error: "You have already flagged this content" },
        { status: 400 }
      );
    }

    // Create the flag
    const [flag] = await db
      .insert(contentFlags)
      .values({
        contentType,
        contentId,
        reporterId: user.id,
        reason,
        description: description?.trim() || null,
        autoDetected: false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      flagId: flag.id,
      message: "Content has been flagged for review",
    });
  } catch (error) {
    console.error("[MODERATION_FLAG_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * GET /api/moderation/flag
 * Get flags for a specific content (for content owners)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const contentType = searchParams.get('contentType') as 'story' | 'comment' | null;
    const contentId = searchParams.get('contentId');

    if (!contentType || !contentId) {
      return NextResponse.json(
        { error: "contentType and contentId are required" },
        { status: 400 }
      );
    }

    // Verify user owns the content or is admin
    let isOwner = false;
    if (contentType === 'story') {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, contentId),
      });
      isOwner = story?.ownerId === user.id;
    } else {
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, contentId),
      });
      isOwner = comment?.userId === user.id;
    }

    if (!isOwner && user.role !== 'admin') {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const flags = await db.query.contentFlags.findMany({
      where: and(
        eq(contentFlags.contentType, contentType),
        eq(contentFlags.contentId, contentId)
      ),
      orderBy: [desc(contentFlags.createdAt)],
    });

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("[MODERATION_FLAG_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
