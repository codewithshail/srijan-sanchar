import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const publishSchema = z.object({
    visibility: z.enum(["public_summary", "public_long"]),
});

export async function PATCH(
    request: NextRequest, 
    { params }: { params: Promise<{ storyId: string }> }
) {
    try {
        // Await the params Promise to get the actual parameters
        const { storyId } = await params;
        
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });

        const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) });
        if (!user) return new NextResponse("User not found", { status: 404 });
        
        const body = await request.json();
        const parsed = publishSchema.safeParse(body);
        if (!parsed.success) {
            return new NextResponse("Invalid request body", { status: 400 });
        }
        const { visibility } = parsed.data;

        const [updatedStory] = await db.update(stories)
            .set({ visibility })
            .where(and(eq(stories.id, storyId), eq(stories.ownerId, user.id)))
            .returning();
        
        if (!updatedStory) {
            return new NextResponse("Story not found or you do not have permission", { status: 404 });
        }
        
        return NextResponse.json({ success: true, visibility: updatedStory.visibility });
    } catch (error) {
        console.error("[STORY_PUBLISH_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}