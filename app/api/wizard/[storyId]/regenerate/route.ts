import { db } from "@/lib/db";
import { stages } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { generateOptionsForStage } from "@/lib/ai/gemini";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    const { storyId } = await params;

    const stage = await db.query.stages.findFirst({
      where: and(eq(stages.storyId, storyId), isNull(stages.selection)),
      orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
    });
    if (!stage) return new NextResponse("No active stage", { status: 400 });

    const previousSelections = (
      await db.query.stages.findMany({
        where: and(eq(stages.storyId, storyId), isNull(stages.selection)),
      })
    )
      .map((s) => s.selection!)
      .filter(Boolean);

    const options = await generateOptionsForStage(
      stage.stageIndex,
      previousSelections
    );
    await db.update(stages).set({ options }).where(eq(stages.id, stage.id));
    return NextResponse.json({ options });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
