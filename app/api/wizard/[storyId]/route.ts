import { db } from "@/lib/db";
import { stages, stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { generateOptionsForStage } from "@/lib/ai/gemini";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const { userId } = await auth();
  const { storyId } = await params;
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });
  if (!user) return new NextResponse("User not found", { status: 404 });

  const story = await db.query.stories.findFirst({
    where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
  });
  if (!story) return new NextResponse("Story not found", { status: 404 });

  if (story.status === "completed") {
    return NextResponse.json({ isCompleted: true });
  }

  const completedStagesCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(stages)
    .where(and(eq(stages.storyId, storyId), sql`selection IS NOT NULL`));
  const currentStageIndex = completedStagesCount[0].count;

  if (currentStageIndex >= 7) {
    await db
      .update(stories)
      .set({ status: "completed" })
      .where(eq(stories.id, storyId));
    return NextResponse.json({ isCompleted: true });
  }

  let currentStage = await db.query.stages.findFirst({
    where: and(
      eq(stages.storyId, storyId),
      eq(stages.stageIndex, currentStageIndex)
    ),
  });

  if (
    !currentStage ||
    !currentStage.options ||
    (Array.isArray(currentStage.options) && currentStage.options.length === 0)
  ) {
    const previousSelections = (
      await db.query.stages.findMany({
        where: and(eq(stages.storyId, storyId), sql`selection IS NOT NULL`),
        orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
      })
    )
      .map((s) => s.selection!)
      .filter(Boolean);
    const newOptions = await generateOptionsForStage(
      currentStageIndex,
      previousSelections
    );
    if (!currentStage) {
      [currentStage] = await db
        .insert(stages)
        .values({ storyId, stageIndex: currentStageIndex, options: newOptions })
        .returning();
    } else {
      [currentStage] = await db
        .update(stages)
        .set({ options: newOptions })
        .where(eq(stages.id, currentStage.id))
        .returning();
    }
  }

  return NextResponse.json({
    currentStageIndex,
    selection: currentStage.selection,
    options: currentStage.options as string[] | null,
    isCompleted: false,
  });
}
