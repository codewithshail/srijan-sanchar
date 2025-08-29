import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { ne } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const publicStories = await db.query.stories.findMany({
            where: ne(stories.visibility, 'private'),
            with: {
                summary: { columns: { userSummary: true } },
                owner: { columns: { id: true } } // Anonymized, can add username later
            },
            orderBy: (stories, { desc }) => [desc(stories.createdAt)],
            limit: 50,
        });

        const formattedStories = publicStories.map(s => ({
            id: s.id,
            title: s.title,
            summarySnippet: s.summary?.userSummary?.substring(0, 150) + '...',
            visibility: s.visibility,
        }));

        return NextResponse.json(formattedStories);
    } catch (error) {
        console.error("[GET_PUBLIC_STORIES_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}