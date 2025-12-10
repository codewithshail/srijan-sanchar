import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { stories, storyStages, lifeStageTemplates } from "@/lib/db/schema";
import { LIFE_STAGES, isValidStageId } from "@/lib/life-stages";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// GET /api/stories/[storyId]/stages - Get all stages for a story
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!story) {
      return new NextResponse("Story not found", { status: 404 });
    }

    // Get existing stages for this story
    const existingStages = await db.query.storyStages.findMany({
      where: eq(storyStages.storyId, storyId),
      orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
    });

    // Get user's templates for pre-filling
    const userTemplates = await db.query.lifeStageTemplates.findMany({
      where: eq(lifeStageTemplates.userId, user.id),
    });

    // Build stage content map
    const stageContentMap: Record<
      string,
      {
        content: string;
        isFromTemplate: boolean;
        audioUrl: string | null;
        updatedAt: Date | null;
      }
    > = {};

    // First, populate with existing story stages
    for (const stage of existingStages) {
      stageContentMap[stage.stageName] = {
        content: stage.content || "",
        isFromTemplate: false,
        audioUrl: stage.audioUrl,
        updatedAt: stage.updatedAt,
      };
    }

    // Then, for empty stages, check if we have templates to pre-fill
    for (const stageDef of LIFE_STAGES) {
      if (!stageContentMap[stageDef.id]) {
        const template = userTemplates.find((t) => t.stageName === stageDef.id);
        stageContentMap[stageDef.id] = {
          content: template?.content || "",
          isFromTemplate: !!template?.content,
          audioUrl: null,
          updatedAt: null,
        };
      }
    }

    // Calculate completion
    const completedStages = LIFE_STAGES.filter(
      (stage) => stageContentMap[stage.id]?.content?.trim()
    ).map((stage) => stage.id);

    return NextResponse.json({
      storyId,
      stages: stageContentMap,
      completedStages,
      totalStages: LIFE_STAGES.length,
      completionPercentage: Math.round(
        (completedStages.length / LIFE_STAGES.length) * 100
      ),
    });
  } catch (error) {
    console.error("[STORY_STAGES_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// POST /api/stories/[storyId]/stages - Save a stage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Verify story ownership
    const story = await db.query.stories.findFirst({
      where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
    });

    if (!story) {
      return new NextResponse("Story not found", { status: 404 });
    }

    const body = await request.json();
    const { stageName, content, saveAsTemplate = false } = body;

    // Validate stage name
    if (!stageName || !isValidStageId(stageName)) {
      return new NextResponse(
        `Invalid stage name. Must be one of: ${LIFE_STAGES.map((s) => s.id).join(", ")}`,
        { status: 400 }
      );
    }

    const stageIndex = LIFE_STAGES.findIndex((s) => s.id === stageName);

    // Check if stage already exists for this story
    const existingStage = await db.query.storyStages.findFirst({
      where: and(
        eq(storyStages.storyId, storyId),
        eq(storyStages.stageName, stageName)
      ),
    });

    let savedStage;

    if (existingStage) {
      // Update existing stage
      const [updated] = await db
        .update(storyStages)
        .set({
          content,
          updatedAt: new Date(),
        })
        .where(eq(storyStages.id, existingStage.id))
        .returning();
      savedStage = updated;
    } else {
      // Create new stage
      const [created] = await db
        .insert(storyStages)
        .values({
          storyId,
          stageIndex,
          stageName,
          content,
        })
        .returning();
      savedStage = created;
    }

    // Optionally save as template for future stories
    if (saveAsTemplate && content?.trim()) {
      const existingTemplate = await db.query.lifeStageTemplates.findFirst({
        where: and(
          eq(lifeStageTemplates.userId, user.id),
          eq(lifeStageTemplates.stageName, stageName)
        ),
      });

      if (existingTemplate) {
        await db
          .update(lifeStageTemplates)
          .set({
            content,
            updatedAt: new Date(),
          })
          .where(eq(lifeStageTemplates.id, existingTemplate.id));
      } else {
        await db.insert(lifeStageTemplates).values({
          userId: user.id,
          stageName,
          content,
        });
      }
    }

    // Update story's updatedAt
    await db
      .update(stories)
      .set({ updatedAt: new Date() })
      .where(eq(stories.id, storyId));

    return NextResponse.json({
      success: true,
      stage: {
        id: savedStage.id,
        stageName: savedStage.stageName,
        content: savedStage.content,
        updatedAt: savedStage.updatedAt,
      },
    });
  } catch (error) {
    console.error("[STORY_STAGES_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
