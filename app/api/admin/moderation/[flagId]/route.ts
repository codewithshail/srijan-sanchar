import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentFlags, users, stories, comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isUserAdmin, getCurrentUser } from "@/lib/auth";

/**
 * GET /api/admin/moderation/[flagId]
 * Get a specific flag details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { flagId } = await params;

    const flag = await db.query.contentFlags.findFirst({
      where: eq(contentFlags.id, flagId),
      with: {
        reporter: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        moderator: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!flag) {
      return new NextResponse("Flag not found", { status: 404 });
    }

    // Get full content
    let fullContent = null;
    let contentOwner = null;

    if (flag.contentType === 'story') {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, flag.contentId),
        with: {
          owner: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              clerkId: true,
            },
          },
        },
      });
      if (story) {
        fullContent = {
          id: story.id,
          title: story.title,
          content: story.content,
          status: story.status,
          createdAt: story.createdAt,
        };
        contentOwner = story.owner;
      }
    } else {
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, flag.contentId),
        with: {
          user: {
            columns: {
              id: true,
              firstName: true,
              lastName: true,
              clerkId: true,
            },
          },
          story: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      });
      if (comment) {
        fullContent = {
          id: comment.id,
          content: comment.content,
          storyId: comment.storyId,
          storyTitle: comment.story?.title,
          createdAt: comment.createdAt,
        };
        contentOwner = comment.user;
      }
    }

    return NextResponse.json({
      flag,
      fullContent,
      contentOwner,
    });
  } catch (error) {
    console.error("[ADMIN_MODERATION_FLAG_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * PATCH /api/admin/moderation/[flagId]
 * Update flag status (approve/reject content)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    const { flagId } = await params;
    const body = await request.json();
    const { action, moderatorNotes } = body as {
      action: 'approve' | 'reject' | 'auto_remove';
      moderatorNotes?: string;
    };

    if (!action || !['approve', 'reject', 'auto_remove'].includes(action)) {
      return NextResponse.json(
        { error: "Valid action is required (approve, reject, auto_remove)" },
        { status: 400 }
      );
    }

    const flag = await db.query.contentFlags.findFirst({
      where: eq(contentFlags.id, flagId),
    });

    if (!flag) {
      return new NextResponse("Flag not found", { status: 404 });
    }

    // Map action to status
    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      auto_remove: 'auto_removed',
    } as const;

    // Update flag
    const [updatedFlag] = await db
      .update(contentFlags)
      .set({
        status: statusMap[action],
        moderatorId: currentUser.id,
        moderatorNotes: moderatorNotes?.trim() || null,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(contentFlags.id, flagId))
      .returning();

    // If rejecting (content is bad), take action on the content
    if (action === 'reject' || action === 'auto_remove') {
      if (flag.contentType === 'story') {
        // Set story to rejected status
        await db
          .update(stories)
          .set({
            status: 'rejected',
            updatedAt: new Date(),
          })
          .where(eq(stories.id, flag.contentId));
      } else {
        // Delete the comment
        await db.delete(comments).where(eq(comments.id, flag.contentId));
      }
    }

    return NextResponse.json({
      success: true,
      flag: updatedFlag,
      message: action === 'approve' 
        ? 'Content approved - flag dismissed'
        : 'Content removed/rejected',
    });
  } catch (error) {
    console.error("[ADMIN_MODERATION_FLAG_PATCH_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
