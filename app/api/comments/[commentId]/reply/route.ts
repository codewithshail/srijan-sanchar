import { db } from "@/lib/db";
import { comments, users, stories } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

// POST - Reply to a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;
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

    // Get the parent comment
    const parentComment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: {
        story: {
          columns: { id: true, status: true },
          with: {
            owner: { columns: { clerkId: true } },
          },
        },
      },
    });

    if (!parentComment) {
      return new NextResponse("Parent comment not found", { status: 404 });
    }

    // Check if story is published or user is owner
    const ownerClerkId = Array.isArray(parentComment.story.owner)
      ? parentComment.story.owner[0]?.clerkId
      : parentComment.story.owner.clerkId;
    const isOwner = userId === ownerClerkId;

    if (parentComment.story.status !== "published" && !isOwner) {
      return new NextResponse("Story not published", { status: 403 });
    }

    const body = await request.json();
    const { content } = body as { content: string };

    if (!content || content.trim().length === 0) {
      return new NextResponse("Reply content is required", { status: 400 });
    }

    if (content.length > 2000) {
      return new NextResponse("Reply too long (max 2000 characters)", {
        status: 400,
      });
    }

    // Create the reply
    const insertResult = await db
      .insert(comments)
      .values({
        storyId: parentComment.storyId,
        userId: user.id,
        content: content.trim(),
        parentCommentId: commentId,
      })
      .returning();

    const newReply = Array.isArray(insertResult) ? insertResult[0] : null;
    
    if (!newReply) {
      return new NextResponse("Failed to create reply", { status: 500 });
    }

    // Fetch the reply with user info
    const replyWithUser = await db.query.comments.findFirst({
      where: eq(comments.id, newReply.id),
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

    return NextResponse.json(replyWithUser, { status: 201 });
  } catch (error) {
    console.error("[COMMENT_REPLY_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
