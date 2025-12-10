import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lifeStageTemplates } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { LIFE_STAGES, LifeStageName } from "../route";

interface RouteParams {
  params: Promise<{ stageName: string }>;
}

// GET /api/user/stage-templates/[stageName] - Get a specific stage template
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { stageName } = await params;

    // Validate stage name
    if (!LIFE_STAGES.includes(stageName as LifeStageName)) {
      return new NextResponse(
        `Invalid stage name. Must be one of: ${LIFE_STAGES.join(", ")}`,
        { status: 400 }
      );
    }

    const template = await db.query.lifeStageTemplates.findFirst({
      where: and(
        eq(lifeStageTemplates.userId, user.id),
        eq(lifeStageTemplates.stageName, stageName)
      ),
    });

    if (!template) {
      return NextResponse.json({
        template: null,
        stageName,
      });
    }

    return NextResponse.json({
      template: {
        id: template.id,
        stageName: template.stageName,
        content: template.content,
        language: template.language,
        updatedAt: template.updatedAt,
      },
    });
  } catch (error) {
    console.error("[STAGE_TEMPLATE_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// PATCH /api/user/stage-templates/[stageName] - Update a specific stage template
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { stageName } = await params;

    // Validate stage name
    if (!LIFE_STAGES.includes(stageName as LifeStageName)) {
      return new NextResponse(
        `Invalid stage name. Must be one of: ${LIFE_STAGES.join(", ")}`,
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content, language } = body;

    // Check if template exists
    const existingTemplate = await db.query.lifeStageTemplates.findFirst({
      where: and(
        eq(lifeStageTemplates.userId, user.id),
        eq(lifeStageTemplates.stageName, stageName)
      ),
    });

    let template;

    if (existingTemplate) {
      // Update existing template
      const updateData: { content?: string; language?: string; updatedAt: Date } = {
        updatedAt: new Date(),
      };
      if (content !== undefined) updateData.content = content;
      if (language !== undefined) updateData.language = language;

      const [updated] = await db
        .update(lifeStageTemplates)
        .set(updateData)
        .where(eq(lifeStageTemplates.id, existingTemplate.id))
        .returning();
      template = updated;
    } else {
      // Create new template if it doesn't exist
      const [created] = await db
        .insert(lifeStageTemplates)
        .values({
          userId: user.id,
          stageName,
          content: content || "",
          language: language || "en",
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
    console.error("[STAGE_TEMPLATE_PATCH_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// DELETE /api/user/stage-templates/[stageName] - Delete a specific stage template
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { stageName } = await params;

    // Validate stage name
    if (!LIFE_STAGES.includes(stageName as LifeStageName)) {
      return new NextResponse(
        `Invalid stage name. Must be one of: ${LIFE_STAGES.join(", ")}`,
        { status: 400 }
      );
    }

    // Delete the template
    await db
      .delete(lifeStageTemplates)
      .where(
        and(
          eq(lifeStageTemplates.userId, user.id),
          eq(lifeStageTemplates.stageName, stageName)
        )
      );

    return NextResponse.json({
      success: true,
      message: `Template for stage '${stageName}' deleted successfully`,
    });
  } catch (error) {
    console.error("[STAGE_TEMPLATE_DELETE_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
