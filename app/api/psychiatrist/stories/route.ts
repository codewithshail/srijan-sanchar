import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stories, summaries, appointments } from "@/lib/db/schema";

export async function GET() {
  try {
    await checkPsychiatristOrAdmin();

    // Get all stories that have been submitted for expert consultation
    // These are stories with confirmed appointments or completed life stories
    const storiesForReview = await db.query.stories.findMany({
      where: and(
        eq(stories.storyType, "life_story"),
        eq(stories.status, "completed")
      ),
      with: {
        summary: {
          columns: {
            userSummary: true,
            psySummary: true,
          },
        },
        owner: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: (stories, { desc }) => [desc(stories.updatedAt)],
    });

    // Transform the data to include summary snippets
    const transformedStories = storiesForReview.map(story => ({
      id: story.id,
      title: story.title,
      summarySnippet: story.summary?.userSummary 
        ? story.summary.userSummary.substring(0, 150) + "..."
        : "No summary available",
      authorName: story.owner.firstName && story.owner.lastName
        ? `${story.owner.firstName} ${story.owner.lastName}`
        : story.owner.firstName || "Anonymous",
      updatedAt: story.updatedAt,
    }));

    return NextResponse.json(transformedStories);
  } catch (error) {
    console.error("[PSY_GET_STORIES_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}