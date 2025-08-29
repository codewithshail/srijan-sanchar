import { db } from "@/lib/db";
import { images, stages, stories, summaries, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { generateImagePrompt, generateSummariesAndSteps } from "@/lib/ai/gemini";
import Replicate from "replicate";

async function triggerBackgroundGeneration(storyId: string) {
    const allStages = await db.query.stages.findMany({
        where: eq(stages.storyId, storyId),
        orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
    });
    const selections = allStages.map(s => s.selection).filter(Boolean) as string[];

    if (selections.length !== 7) return;

    // Run AI tasks in parallel
    const [summaryData, imagePrompt] = await Promise.all([
        generateSummariesAndSteps(selections),
        generateImagePrompt(selections),
    ]);

    await db.insert(summaries).values({
        storyId,
        userSummary: summaryData.userSummary,
        psySummary: summaryData.psySummary,
        actionableSteps: summaryData.actionableSteps,
    });
    
    // Generate Image with Replicate
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN! });
    const model: `${string}/${string}` = "black-forest-labs/FLUX.1-schnell";
    const output = await replicate.run(model, { input: { prompt: imagePrompt } } as unknown as Parameters<typeof replicate.run>[1]);
    const imageUrl = Array.isArray(output) ? String(output[0]) : String(output);

    await db.insert(images).values({ storyId, prompt: imagePrompt, url: imageUrl });

    // Finalize story
    await db.update(stories)
        .set({ status: 'completed', title: `Story of a Journey` })
        .where(eq(stories.id, storyId));
}

export async function POST(request: NextRequest, context: { params: Promise<{ storyId: string }> }) {
    try {
        const { storyId } = await context.params;
        const { userId } = await auth();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        
        const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) });
        if (!user) return new NextResponse("User not found", { status: 404 });

        const body = await request.json();
        const { selection } = body;
        if (!selection) return new NextResponse("Selection is required", { status: 400 });

        const currentStageData = await db.query.stages.findFirst({
            where: and(eq(stages.storyId, storyId), isNull(stages.selection)),
            orderBy: (stages, { asc }) => [asc(stages.stageIndex)],
        });

        if (!currentStageData) return new NextResponse("No active stage found", { status: 404 });

        await db.update(stages)
            .set({ selection })
            .where(eq(stages.id, currentStageData.id));
        
        await db.update(stories).set({ updatedAt: new Date() }).where(eq(stories.id, storyId));
        
        if (currentStageData.stageIndex === 6) {
            // Note: You'll need to add 'generating_summary' to your enum or use 'draft'
            await db.update(stories)
                .set({ status: 'draft' }) // Changed from 'generating_summary'
                .where(eq(stories.id, storyId));

            triggerBackgroundGeneration(storyId);
            
            return NextResponse.json({ isCompleted: true });
        }
        
        return NextResponse.json({ isCompleted: false });
    } catch (error) {
        console.error("[WIZARD_NEXT_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}