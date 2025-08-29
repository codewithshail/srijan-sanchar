import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        
        const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) });
        if (!user) return new NextResponse("User not found", { status: 404 });

        const userStories = await db.query.stories.findMany({
            where: eq(stories.ownerId, user.id),
            orderBy: (stories, { desc }) => [desc(stories.updatedAt)],
            columns: { id: true, title: true, status: true, updatedAt: true }
        });

        return NextResponse.json(userStories);
    } catch (error) {
        console.error("[GET_STORIES_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

export async function POST() {
    try {
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        
        const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) });
        if (!user) return new NextResponse("User not found", { status: 404 });
        
        const [newStory] = await db.insert(stories).values({ ownerId: user.id }).returning({ id: stories.id });

        return NextResponse.json({ id: newStory.id });
    } catch (error) {
        console.error("[POST_STORY_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}