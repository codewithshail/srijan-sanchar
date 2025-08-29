import { db } from "@/lib/db";
import { checkAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        await checkAdmin();
        
        const allStories = await db.query.stories.findMany({
            with: {
                owner: {
                    columns: {
                        clerkId: true,
                    }
                }
            },
            orderBy: (stories, { desc }) => [desc(stories.createdAt)],
        });

        return NextResponse.json(allStories);
    } catch (error) {
        console.error("[ADMIN_GET_STORIES_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}