import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    if (!user) return new NextResponse("User not found", { status: 404 });
    const userStories = await db.query.stories.findMany({
      where: eq(stories.ownerId, user.id),
      orderBy: (stories, { desc: d }) => [d(stories.updatedAt)],
      columns: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        visibility: true,
        storyType: true,
        viewCount: true,
        listenCount: true,
      },
    });
    return NextResponse.json(userStories);
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      console.error("[STORIES_POST] No userId from auth");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log("[STORIES_POST] Looking for user with clerkId:", userId);
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    
    if (!user) {
      console.error("[STORIES_POST] User not found for clerkId:", userId);
      return new NextResponse("User not found", { status: 404 });
    }

    console.log("[STORIES_POST] Found user:", user.id);

    const body = await request.json().catch(() => ({}));
    const inputTitle: string | undefined = body?.title;
    const storyType: 'life_story' | 'blog_story' = body?.storyType || 'life_story';
    
    const defaultTitle = user.firstName
      ? `${user.firstName} Story`
      : "My Story";

    console.log("[STORIES_POST] Creating story with:", {
      ownerId: user.id,
      title: inputTitle?.trim() || defaultTitle,
      storyType
    });

    const [newStory] = await db
      .insert(stories)
      .values({ 
        ownerId: user.id, 
        title: inputTitle?.trim() || defaultTitle,
        storyType: storyType
      })
      .returning({ id: stories.id });
    
    console.log("[STORIES_POST] Created story:", newStory.id);
    return NextResponse.json({ id: newStory.id });
  } catch (error) {
    console.error("[STORIES_POST] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
