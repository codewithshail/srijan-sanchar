import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { stories } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    await checkPsychiatristOrAdmin();

    const { storyId } = await params;

    const story = await db.query.stories.findFirst({
      where: and(
        eq(stories.id, storyId),
        eq(stories.storyType, "life_story"),
        eq(stories.status, "completed")
      ),
      with: {
        summary: true,
        image: true,
        owner: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            clerkId: true,
          },
        },
        stages: {
          orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
        },
      },
    });

    if (!story) {
      return new NextResponse("Story not found or not accessible", { status: 404 });
    }

    return NextResponse.json(story);
  } catch (error) {
    console.error("[PSY_GET_STORY_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}