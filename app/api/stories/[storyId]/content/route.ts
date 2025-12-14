import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
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

    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
      columns: {
        id: true,
        title: true,
        content: true,
        description: true,
        storyType: true,
        status: true,
        updatedAt: true,
      },
    });

    if (!story) {
      return new NextResponse("Story not found", { status: 404 });
    }

    console.log('[CONTENT_GET] Retrieved content length:', (story.content || "").length);
    console.log('[CONTENT_GET] Content preview:', (story.content || "").substring(0, 200) + '...');

    return NextResponse.json({
      id: story.id,
      title: story.title,
      content: story.content || "",
      description: story.description || "",
      storyType: story.storyType,
      status: story.status,
      updatedAt: story.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching story content:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
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
    const { content, title, description } = body as {
      content?: string;
      title?: string;
      description?: string;
    };

    // Validate that this is a blog story
    const existingStory = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
      columns: { storyType: true },
    });

    if (!existingStory) {
      return new NextResponse("Story not found", { status: 404 });
    }

    if (existingStory.storyType !== "blog_story") {
      return new NextResponse("This endpoint is only for blog stories", { status: 400 });
    }

    const updateData: Partial<typeof stories.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof content === "string") {
      console.log('[CONTENT_UPDATE] Content length:', content.length);
      console.log('[CONTENT_UPDATE] Content preview:', content.substring(0, 200) + '...');
      updateData.content = content;
    }

    if (typeof title === "string") {
      updateData.title = title.trim() || null;
    }

    if (typeof description === "string") {
      updateData.description = description.trim() || null;
    }

    const [updatedStory] = await db
      .update(stories)
      .set(updateData)
      .where(and(eq(stories.id, storyId), eq(stories.ownerId, user.id)))
      .returning({
        id: stories.id,
        title: stories.title,
        content: stories.content,
        description: stories.description,
        updatedAt: stories.updatedAt,
      });

    if (!updatedStory) {
      return new NextResponse("Failed to update story", { status: 500 });
    }

    return NextResponse.json({
      id: updatedStory.id,
      title: updatedStory.title,
      content: updatedStory.content || "",
      description: updatedStory.description || "",
      updatedAt: updatedStory.updatedAt,
    });
  } catch (error) {
    console.error("Error updating story content:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}