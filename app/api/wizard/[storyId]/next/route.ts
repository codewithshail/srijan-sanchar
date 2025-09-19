import { db } from "@/lib/db";
import { images, stages, stories, summaries, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  generateImagePrompt,
  generateSummariesAndSteps,
  generateFullStory,
} from "@/lib/ai/gemini";

type GenerationConfig = {
  generateImage: boolean;
  storyType: "summary" | "full";
  pageCount: number;
};

async function triggerBackgroundGeneration(
  storyId: string,
  config: GenerationConfig
) {
  const allStages = await db.query.stages.findMany({
    where: eq(stages.storyId, storyId),
    orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
  });
  const selections = allStages
    .map((s) => s.selection)
    .filter(Boolean) as string[];
  if (selections.length !== 7) return;

  const summaryData = await generateSummariesAndSteps(selections);

  let longFormStory: string | undefined = undefined;
  if (config.storyType === "full") {
    longFormStory = await generateFullStory(selections, config.pageCount);
  }

  await db.insert(summaries).values({
    storyId,
    userSummary: summaryData.userSummary,
    psySummary: summaryData.psySummary,
    actionableSteps: summaryData.actionableSteps,
    longFormStory,
  });

  if (config.generateImage) {
    const imagePrompt = await generateImagePrompt(selections);
    await db
      .insert(images)
      .values({
        storyId,
        prompt: imagePrompt,
        url: "/placeholder.svg?height=720&width=1280",
      });
  }

  await db
    .update(stories)
    .set({ status: "completed", title: "A New Chapter" })
    .where(eq(stories.id, storyId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const body = await request.json();
    const { selection, config } = body as {
      selection: string;
      config: GenerationConfig;
    };
    if (!selection)
      return new NextResponse("Selection is required", { status: 400 });

    const currentStageData = await db.query.stages.findFirst({
      where: and(eq(stages.storyId, storyId), isNull(stages.selection)),
      orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
    });
    if (!currentStageData)
      return new NextResponse("No active stage found", { status: 404 });

    await db
      .update(stages)
      .set({ selection })
      .where(eq(stages.id, currentStageData.id));
    await db
      .update(stories)
      .set({ updatedAt: new Date() })
      .where(eq(stories.id, storyId));

    if (currentStageData.stageIndex === 6) {
      await db
        .update(stories)
        .set({ status: "draft", generationConfig: config })
        .where(eq(stories.id, storyId));
      triggerBackgroundGeneration(storyId, config);
      return NextResponse.json({ isCompleted: true });
    }

    return NextResponse.json({ isCompleted: false });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
