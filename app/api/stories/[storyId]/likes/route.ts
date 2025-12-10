import { db } from "@/lib/db";
import { likes, stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, count } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

// GET - Get like count and whether current user has liked
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { userId } = await auth();

    // Check if story exists
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { id: true, status: true },
    });

    if (!story) {
      return new NextResponse("Story not found", { status: 404 });
    }

    // Get like count
    const [likeCount] = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.storyId, storyId));

    // Check if current user has liked (if authenticated)
    let hasLiked = false;
    if (userId) {
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
        columns: { id: true },
      });

      if (user) {
        const existingLike = await db.query.likes.findFirst({
          where: and(eq(likes.storyId, storyId), eq(likes.userId, user.id)),
        });
        hasLiked = !!existingLike;
      }
    }

    return NextResponse.json({
      count: likeCount.count,
      hasLiked,
    });
  } catch (error) {
    console.error("[LIKES_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}


// POST - Like a story
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { id: true },
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

    // Only allow liking published stories (or if owner)
    if (story.status !== "published" && !isOwner) {
      return new NextResponse("Story not published", { status: 403 });
    }

    // Check if already liked
    const existingLike = await db.query.likes.findFirst({
      where: and(eq(likes.storyId, storyId), eq(likes.userId, user.id)),
    });

    if (existingLike) {
      return new NextResponse("Already liked", { status: 409 });
    }

    // Create the like
    await db.insert(likes).values({
      storyId,
      userId: user.id,
    });

    // Get updated count
    const [likeCount] = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.storyId, storyId));

    return NextResponse.json(
      { count: likeCount.count, hasLiked: true },
      { status: 201 }
    );
  } catch (error) {
    console.error("[LIKES_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE - Unlike a story
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { id: true },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Delete the like
    const [deleted] = await db
      .delete(likes)
      .where(and(eq(likes.storyId, storyId), eq(likes.userId, user.id)))
      .returning({ id: likes.id });

    if (!deleted) {
      return new NextResponse("Like not found", { status: 404 });
    }

    // Get updated count
    const [likeCount] = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.storyId, storyId));

    return NextResponse.json({ count: likeCount.count, hasLiked: false });
  } catch (error) {
    console.error("[LIKES_DELETE_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
