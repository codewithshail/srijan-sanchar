import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { ne } from "drizzle-orm";
import { NextResponse } from "next/server";

// This route returns public stories, but it's protected to ensure only authorized roles can access it
// An admin can also use this view.
export async function GET() {
    try {
        await checkPsychiatristOrAdmin();
        
        const publicStories = await db.query.stories.findMany({
            where: ne(stories.visibility, 'private'),
            with: {
                summary: { columns: { userSummary: true } },
            },
            orderBy: (stories, { desc }) => [desc(stories.createdAt)],
            limit: 100,
        });

        const formattedStories = publicStories.map(s => ({
            id: s.id,
            title: s.title,
            summarySnippet: s.summary?.userSummary?.substring(0, 150) + '...',
        }));

        return NextResponse.json(formattedStories);
    } catch (error) {
        console.error("[PSY_GET_STORIES_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}