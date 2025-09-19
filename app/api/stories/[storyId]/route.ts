import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { isUserAdmin } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { userId } = await auth();
    const storyData = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      with: {
        summary: true,
        image: true,
        owner: { 
          columns: { 
            id: true, 
            clerkId: true, 
            firstName: true, 
            lastName: true 
          } 
        },
      },
    });
    if (!storyData) return new NextResponse("Story not found", { status: 404 });
    const isOwner = userId === storyData.owner.clerkId;
    const isPublic = storyData.visibility !== "private";
    const isAdmin = await isUserAdmin();
    if (!isOwner && !isPublic && !isAdmin)
      return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json(storyData);
  } catch {
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
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const body = await request.json();
    const { title, visibility, content } = body as {
      title?: string;
      visibility?: "private" | "public_summary" | "public_long";
      content?: string;
    };

    const setters: Partial<typeof stories.$inferInsert> = {};
    if (typeof title === "string") setters.title = title.trim() || null;
    if (visibility) setters.visibility = visibility;
    if (typeof content === "string") setters.content = content;

    const [updated] = await db
      .update(stories)
      .set({ ...setters, updatedAt: new Date() })
      .where(and(eq(stories.id, storyId), eq(stories.ownerId, user.id)))
      .returning();
    if (!updated) return new NextResponse("Not found", { status: 404 });
    return NextResponse.json(updated);
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    if (!user) return new NextResponse("User not found", { status: 404 });
    const [deleted] = await db
      .delete(stories)
      .where(and(eq(stories.id, storyId), eq(stories.ownerId, user.id)))
      .returning({ id: stories.id });
    if (!deleted) return new NextResponse("Not found", { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
