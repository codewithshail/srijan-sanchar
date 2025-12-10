import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lifeStageTemplates } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { LIFE_STAGES, LifeStageName } from "../route";

interface BulkTemplateInput {
  stageName: string;
  content: string;
  language?: string;
}

// POST /api/user/stage-templates/bulk - Save multiple stage templates at once
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { templates } = body as { templates: BulkTemplateInput[] };

    if (!templates || !Array.isArray(templates)) {
      return new NextResponse("Invalid request body. Expected { templates: [...] }", {
        status: 400,
      });
    }

    // Validate all stage names
    const invalidStages = templates.filter(
      (t) => !LIFE_STAGES.includes(t.stageName as LifeStageName)
    );
    if (invalidStages.length > 0) {
      return new NextResponse(
        `Invalid stage names: ${invalidStages.map((t) => t.stageName).join(", ")}. Must be one of: ${LIFE_STAGES.join(", ")}`,
        { status: 400 }
      );
    }

    // Get existing templates for this user
    const stageNames = templates.map((t) => t.stageName);
    const existingTemplates = await db.query.lifeStageTemplates.findMany({
      where: and(
        eq(lifeStageTemplates.userId, user.id),
        inArray(lifeStageTemplates.stageName, stageNames)
      ),
    });

    const existingMap = new Map(
      existingTemplates.map((t) => [t.stageName, t])
    );

    const results: Array<{
      stageName: string;
      action: "created" | "updated";
      success: boolean;
    }> = [];

    // Process each template
    for (const templateInput of templates) {
      const existing = existingMap.get(templateInput.stageName);

      try {
        if (existing) {
          // Update existing template
          await db
            .update(lifeStageTemplates)
            .set({
              content: templateInput.content,
              language: templateInput.language || "en",
              updatedAt: new Date(),
            })
            .where(eq(lifeStageTemplates.id, existing.id));

          results.push({
            stageName: templateInput.stageName,
            action: "updated",
            success: true,
          });
        } else {
          // Create new template
          await db.insert(lifeStageTemplates).values({
            userId: user.id,
            stageName: templateInput.stageName,
            content: templateInput.content,
            language: templateInput.language || "en",
          });

          results.push({
            stageName: templateInput.stageName,
            action: "created",
            success: true,
          });
        }
      } catch (error) {
        console.error(`Error processing template for ${templateInput.stageName}:`, error);
        results.push({
          stageName: templateInput.stageName,
          action: existing ? "updated" : "created",
          success: false,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failureCount === 0,
      message: `Processed ${successCount} templates successfully${failureCount > 0 ? `, ${failureCount} failed` : ""}`,
      results,
    });
  } catch (error) {
    console.error("[STAGE_TEMPLATES_BULK_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
