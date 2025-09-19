import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const publishSchema = z.object({
  bannerImageUrl: z.string().url(),
  thumbnailImageUrl: z.string().url(),
  visibility: z.enum(["private", "public_summary", "public_long"]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
});

export async function POST(
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

    // Validate request body
    const body = await request.json();
    const parsed = publishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error },
        { status: 400 }
      );
    }

    const { bannerImageUrl, thumbnailImageUrl, visibility, title } =
      parsed.data;

    // Check if story exists and user owns it
    const existingStory = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!existingStory) {
      return new NextResponse("Story not found", { status: 404 });
    }

    // Update story with publication data
    const [updatedStory] = await db
      .update(stories)
      .set({
        title,
        bannerImageUrl,
        thumbnailImageUrl,
        visibility,
        status: visibility === "private" ? "completed" : "published",
        publishedAt: visibility === "private" ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(stories.id, storyId), eq(stories.ownerId, user.id)))
      .returning();

    if (!updatedStory) {
      return new NextResponse("Failed to update story", { status: 500 });
    }

    return NextResponse.json({
      success: true,
      story: updatedStory,
    });
  } catch (error) {
    console.error("Publication error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
