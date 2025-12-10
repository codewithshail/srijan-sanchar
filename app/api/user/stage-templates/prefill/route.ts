import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lifeStageTemplates, storyStages, stories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import {
  LIFE_STAGES,
  prefillStagesFromTemplates,
  calculateStageCompletion,
  getStagePrompts,
  LifeStageId,
} from "@/lib/life-stages";

// GET /api/user/stage-templates/prefill - Get pre-filled content for a new life story
// Query params:
//   - storyId (optional): If provided, merge with existing story stages
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get("storyId");

    // Get user's saved templates
    const templates = await db.query.lifeStageTemplates.findMany({
      where: eq(lifeStageTemplates.userId, user.id),
    });

    // Transform templates to a map
    const templateMap: Record<string, { content: string; language: string }> = {};
    for (const template of templates) {
      templateMap[template.stageName] = {
        content: template.content || "",
        language: template.language || "en",
      };
    }

    // Get existing story stages if storyId is provided
    const existingContent: Record<string, string> = {};

    if (storyId) {
      // Verify the story belongs to the user
      const story = await db.query.stories.findFirst({
        where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
      });

      if (story) {
        const stages = await db.query.storyStages.findMany({
          where: eq(storyStages.storyId, storyId),
        });

        for (const stage of stages) {
          existingContent[stage.stageName] = stage.content || "";
        }
      }
    }

    // Pre-fill stages from templates
    const prefilledStages = prefillStagesFromTemplates(existingContent, templateMap);

    // Calculate completion
    const contentMap: Record<string, string> = {};
    for (const [stageId, stage] of Object.entries(prefilledStages)) {
      contentMap[stageId] = stage.content;
    }
    const completion = calculateStageCompletion(contentMap);

    // Build response with stage metadata
    const stagesWithMetadata = LIFE_STAGES.map((stage) => {
      const prefilled = prefilledStages[stage.id];
      return {
        ...stage,
        content: prefilled?.content || "",
        language: prefilled?.language || "en",
        isFromTemplate: prefilled?.isFromTemplate || false,
        isCompleted: completion.completedStages.includes(stage.id),
        prompts: getStagePrompts(stage.id as LifeStageId),
      };
    });

    return NextResponse.json({
      stages: stagesWithMetadata,
      completion: {
        completedCount: completion.completedCount,
        totalCount: completion.totalCount,
        percentage: completion.percentage,
      },
      hasTemplates: templates.length > 0,
      templateCount: templates.length,
    });
  } catch (error) {
    console.error("[STAGE_TEMPLATES_PREFILL_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
