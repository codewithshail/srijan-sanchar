import { db } from "@/lib/db";
import { comments, stories, users, contentFlags } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull, desc, asc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { contentModerationService } from "@/lib/moderation";
import { 
  checkRateLimit, 
  recordRateLimitedRequest,
  getRateLimitErrorResponse 
} from "@/lib/rate-limiting";

// GET - Fetch all comments for a story (with nested replies)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    // Check if story exists and is published (or user is owner)
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { id: true, status: true, ownerId: true },
      with: {
        owner: { columns: { clerkId: true } },
      },
    });

    if (!story) {
      return new NextResponse("Story not found", { status: 404 });
    }

    // Get current user to check ownership
    const { userId } = await auth();
    const ownerClerkId = Array.isArray(story.owner)
      ? story.owner[0]?.clerkId
      : story.owner.clerkId;
    const isOwner = userId === ownerClerkId;

    // Only allow viewing comments on published stories or if owner
    if (story.status !== "published" && !isOwner) {
      return new NextResponse("Story not published", { status: 403 });
    }

    // Fetch top-level comments (no parent)
    const topLevelComments = await db.query.comments.findMany({
      where: and(
        eq(comments.storyId, storyId),
        isNull(comments.parentCommentId)
      ),
      orderBy: [desc(comments.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true,
          },
        },
      },
    });

    // Fetch all replies for this story
    const allReplies = await db.query.comments.findMany({
      where: and(
        eq(comments.storyId, storyId),
        // parentCommentId is not null - has a parent
      ),
      orderBy: [asc(comments.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true,
          },
        },
      },
    });

    // Filter replies (those with parentCommentId)
    const replies = allReplies.filter((c) => c.parentCommentId !== null);

    // Build nested structure
    const commentsWithReplies = topLevelComments.map((comment) => ({
      ...comment,
      replies: replies.filter((r) => r.parentCommentId === comment.id),
    }));

    return NextResponse.json(commentsWithReplies);
  } catch (error) {
    console.error("[COMMENTS_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}


// POST - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    // Check rate limit for comments
    const { allowed, result } = await checkRateLimit(request, "comments");
    if (!allowed && result) {
      return getRateLimitErrorResponse(result);
    }

    const { storyId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Record the request after successful auth
    await recordRateLimitedRequest(request, "comments");

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Check if story exists and is published
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { id: true, status: true, ownerId: true },
      with: {
        owner: { columns: { clerkId: true } },
      },
    });

    if (!story) {
      return new NextResponse("Story not found", { status: 404 });
    }

    const ownerClerkId = Array.isArray(story.owner)
      ? story.owner[0]?.clerkId
      : story.owner.clerkId;
    const isOwner = userId === ownerClerkId;

    // Only allow comments on published stories or if owner
    if (story.status !== "published" && !isOwner) {
      return new NextResponse("Story not published", { status: 403 });
    }

    const body = await request.json();
    const { content, parentCommentId } = body as {
      content: string;
      parentCommentId?: string;
    };

    if (!content || content.trim().length === 0) {
      return new NextResponse("Comment content is required", { status: 400 });
    }

    if (content.length > 2000) {
      return new NextResponse("Comment too long (max 2000 characters)", {
        status: 400,
      });
    }

    // If replying, verify parent comment exists and belongs to same story
    if (parentCommentId) {
      const parentComment = await db.query.comments.findFirst({
        where: and(
          eq(comments.id, parentCommentId),
          eq(comments.storyId, storyId)
        ),
      });

      if (!parentComment) {
        return new NextResponse("Parent comment not found", { status: 404 });
      }
    }

    // Check content for moderation issues
    const moderationResult = await contentModerationService.moderateContent(
      content.trim(),
      'comment'
    );

    // If content should be auto-removed, reject it immediately
    if (contentModerationService.shouldAutoRemove(moderationResult)) {
      return NextResponse.json(
        { 
          error: "Your comment was flagged for review. Please ensure your comment follows our community guidelines.",
          reason: moderationResult.reason 
        },
        { status: 400 }
      );
    }

    // Create the comment
    const insertResult = await db
      .insert(comments)
      .values({
        storyId,
        userId: user.id,
        content: content.trim(),
        parentCommentId: parentCommentId || null,
      })
      .returning();
    
    const newComment = Array.isArray(insertResult) ? insertResult[0] : null;
    
    if (!newComment) {
      return new NextResponse("Failed to create comment", { status: 500 });
    }

    // If content was flagged but not auto-removed, create a flag for review
    if (moderationResult.flagged && moderationResult.reason) {
      await db.insert(contentFlags).values({
        contentType: 'comment',
        contentId: newComment.id,
        reason: moderationResult.reason,
        description: moderationResult.details || null,
        autoDetected: true,
        confidenceScore: moderationResult.confidenceScore,
      });
    }

    // Fetch the comment with user info
    const commentWithUser = await db.query.comments.findFirst({
      where: eq(comments.id, newComment.id),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true,
          },
        },
      },
    });

    return NextResponse.json(commentWithUser, { status: 201 });
  } catch (error) {
    console.error("[COMMENTS_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
