import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  try {
    await checkPsychiatristOrAdmin();
    const { storyId } = await params;

    const storyData = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      with: {
        summary: true,
        image: true,
        owner: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!storyData) {
      return new NextResponse("Story not found", { status: 404 });
    }

    return NextResponse.json(storyData);
  } catch (error) {
    console.error("[PSY_GET_STORY_ID_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
