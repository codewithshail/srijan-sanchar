import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lifeStageTemplates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Valid life stage names
export const LIFE_STAGES = [
  "childhood",
  "teenage",
  "young_adult",
  "career_growth",
  "marriage_family",
  "maturity",
  "wisdom_years",
] as const;

export type LifeStageName = (typeof LIFE_STAGES)[number];

// GET /api/user/stage-templates - Retrieve all user templates
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const templates = await db.query.lifeStageTemplates.findMany({
      where: eq(lifeStageTemplates.userId, user.id),
      orderBy: (templates, { asc }) => [asc(templates.stageName)],
    });

    // Transform to a map for easier client-side usage
    const templateMap: Record<string, { content: string; language: string; updatedAt: Date }> = {};
    for (const template of templates) {
      templateMap[template.stageName] = {
        content: template.content || "",
        language: template.language || "en",
        updatedAt: template.updatedAt,
      };
    }

    return NextResponse.json({
      templates: templateMap,
      stages: LIFE_STAGES,
    });
  } catch (error) {
    console.error("[STAGE_TEMPLATES_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// POST /api/user/stage-templates - Save or update a stage template
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { stageName, content, language = "en" } = body;

    // Validate stage name
    if (!stageName || !LIFE_STAGES.includes(stageName)) {
      return new NextResponse(
        `Invalid stage name. Must be one of: ${LIFE_STAGES.join(", ")}`,
        { status: 400 }
      );
    }

    // Check if template already exists for this user and stage
    const existingTemplate = await db.query.lifeStageTemplates.findFirst({
      where: and(
        eq(lifeStageTemplates.userId, user.id),
        eq(lifeStageTemplates.stageName, stageName)
      ),
    });

    let template;

    if (existingTemplate) {
      // Update existing template
      const [updated] = await db
        .update(lifeStageTemplates)
        .set({
          content,
          language,
          updatedAt: new Date(),
        })
        .where(eq(lifeStageTemplates.id, existingTemplate.id))
        .returning();
      template = updated;
    } else {
      // Create new template
      const [created] = await db
        .insert(lifeStageTemplates)
        .values({
          userId: user.id,
          stageName,
          content,
          language,
        })
        .returning();
      template = created;
    }

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        stageName: template.stageName,
        content: template.content,
        language: template.language,
        updatedAt: template.updatedAt,
      },
    });
  } catch (error) {
    console.error("[STAGE_TEMPLATES_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
