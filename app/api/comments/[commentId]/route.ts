import { db } from "@/lib/db";
import { comments, users, stories } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { isUserAdmin } from "@/lib/auth";

// GET - Get a single comment
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const { commentId } = await params;

    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: {
        user: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true,
          },
        },
        replies: {
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
        },
      },
    });

    if (!comment) {
      return new NextResponse("Comment not found", { status: 404 });
    }

    return NextResponse.json(comment);
  } catch (error) {
    console.error("[COMMENT_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PATCH - Update a comment (only by owner)
export async function PATCH(
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

    const body = await request.json();
    const { content } = body as { content: string };

    if (!content || content.trim().length === 0) {
      return new NextResponse("Comment content is required", { status: 400 });
    }

    if (content.length > 2000) {
      return new NextResponse("Comment too long (max 2000 characters)", {
        status: 400,
      });
    }

    // Update only if user owns the comment
    const [updated] = await db
      .update(comments)
      .set({
        content: content.trim(),
        updatedAt: new Date(),
      })
      .where(and(eq(comments.id, commentId), eq(comments.userId, user.id)))
      .returning();

    if (!updated) {
      return new NextResponse("Comment not found or not authorized", {
        status: 404,
      });
    }

    // Fetch updated comment with user info
    const commentWithUser = await db.query.comments.findFirst({
      where: eq(comments.id, updated.id),
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

    return NextResponse.json(commentWithUser);
  } catch (error) {
    console.error("[COMMENT_PATCH_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}


// DELETE - Delete a comment (by owner, story owner, or admin)
export async function DELETE(
  _request: NextRequest,
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

    // Get the comment with story info
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, commentId),
      with: {
        story: {
          columns: { ownerId: true },
        },
      },
    });

    if (!comment) {
      return new NextResponse("Comment not found", { status: 404 });
    }

    // Check if user can delete: comment owner, story owner, or admin
    const isCommentOwner = comment.userId === user.id;
    const isStoryOwner = comment.story.ownerId === user.id;
    const isAdmin = await isUserAdmin();

    if (!isCommentOwner && !isStoryOwner && !isAdmin) {
      return new NextResponse("Not authorized to delete this comment", {
        status: 403,
      });
    }

    // Delete the comment (cascade will delete replies)
    await db.delete(comments).where(eq(comments.id, commentId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[COMMENT_DELETE_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
