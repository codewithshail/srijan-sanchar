import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { ne } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const publicStories = await db.query.stories.findMany({
      where: ne(stories.visibility, "private"),
      with: {
        summary: { columns: { userSummary: true, longFormStory: true } },
      },
      orderBy: (stories, { desc }) => [desc(stories.createdAt)],
      limit: 50,
    });
    const formatted = publicStories.map((s) => ({
      id: s.id,
      title: s.title,
      visibility: s.visibility,
      summarySnippet: (s.summary?.userSummary || "").slice(0, 250) + "...",
    }));
    return NextResponse.json(formatted);
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
