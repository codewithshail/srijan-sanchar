import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { eq, and, or, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { stories, summaries, appointments } from "@/lib/db/schema";

export async function GET() {
  try {
    await checkPsychiatristOrAdmin();

    // Get all completed stories and published stories for review
    const storiesForReview = await db.query.stories.findMany({
      where: or(
        eq(stories.status, "completed"),
        eq(stories.status, "published"),
        eq(stories.status, "pending_review")
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
            clerkId: true,
          },
        },
      },
      orderBy: (stories, { desc }) => [desc(stories.updatedAt)],
    });

    // Transform the data to include enhanced information
    const transformedStories = storiesForReview.map(story => ({
      id: story.id,
      title: story.title,
      storyType: story.storyType,
      status: story.status,
      createdAt: story.createdAt,
      viewCount: story.viewCount,
      listenCount: story.listenCount,
      summarySnippet: (() => {
        const summary = Array.isArray(story.summary) ? story.summary[0] : story.summary;
        if (summary?.userSummary) {
          return summary.userSummary.substring(0, 150) + "...";
        }
        return story.content 
          ? story.content.substring(0, 150) + "..."
          : "No content available";
      })(),
      owner: (() => {
        const owner = Array.isArray(story.owner) ? story.owner[0] : story.owner;
        return {
          firstName: owner?.firstName,
          lastName: owner?.lastName,
          clerkId: owner?.clerkId,
        };
      })(),
    }));

    return NextResponse.json(transformedStories);
  } catch (error) {
    console.error("[PSY_GET_STORIES_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}