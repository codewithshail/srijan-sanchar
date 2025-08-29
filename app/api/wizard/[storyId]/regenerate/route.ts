import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, sql, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { generateOptionsForStage } from "@/lib/ai/gemini";

export async function POST(request: NextRequest, context: { params: Promise<{ storyId: string }> }) {
    try {
        const { storyId } = await context.params;
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });

        const currentStage = await db.query.stages.findFirst({
            where: and(eq(stages.storyId, storyId), isNull(stages.selection)),
            orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
        });

        if (!currentStage) return new NextResponse("No active stage found", { status: 404 });

        const previousSelections = (await db.query.stages.findMany({
            where: and(eq(stages.storyId, storyId), sql`selection IS NOT NULL`),
            orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
        })).map(s => s.selection!);

        const newOptions = await generateOptionsForStage(currentStage.stageIndex, previousSelections);

        await db.update(stages)
            .set({ options: newOptions, regenerationCount: sql`${stages.regenerationCount} + 1` })
            .where(eq(stages.id, currentStage.id));

        return NextResponse.json({ options: newOptions });
    } catch (error) {
        console.error("[WIZARD_REGENERATE_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}