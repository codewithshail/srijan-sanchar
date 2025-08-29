import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, context: { params: Promise<{ storyId: string }> }) {
    try {
        const { storyId } = await context.params;
        const { userId } = await auth();
        
        const storyData = await db.query.stories.findFirst({
            where: eq(stories.id, storyId),
            with: {
                summary: true,
                image: true,
                owner: { columns: { id: true, clerkId: true } }
            }
        });

        if (!storyData) return new NextResponse("Story not found", { status: 404 });

        const isOwner = userId === storyData.owner.clerkId;
        const isPublic = storyData.visibility !== 'private';

        if (!isOwner && !isPublic) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        return NextResponse.json(storyData);
    } catch (error) {
        console.error("[GET_STORY_ID_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}