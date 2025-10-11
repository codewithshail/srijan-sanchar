import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { generationJobs, stories, storyStages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GeminiService } from '@/lib/ai/gemini-service';
import { JobData, JobResult } from '../queue';

const geminiService = new GeminiService();

export interface StoryGenerationConfig {
  includeAIImages?: boolean;
  numberOfPages?: number;
  improveGrammar?: boolean;
  tone?: 'formal' | 'casual' | 'poetic' | 'narrative';
  targetAudience?: 'children' | 'adults' | 'all';
  imageStyle?: 'realistic' | 'artistic' | 'minimalist';
}

/**
 * Process story generation job
 * Generates a story with the specified number of pages
 */
export async function processStoryGeneration(
  job: Job<JobData>
): Promise<JobResult> {
  const { storyId, config } = job.data;
  const generationConfig = config as StoryGenerationConfig;

  try {
    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await job.updateProgress(10);

    // Fetch story
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    await job.updateProgress(20);

    let rawContent: string;

    // Get raw content based on story type
    if (story.storyType === 'life_story') {
      // Fetch all stages
      const stages = await db
        .select()
        .from(storyStages)
        .where(eq(storyStages.storyId, storyId))
        .orderBy(storyStages.stageIndex);

      if (stages.length === 0) {
        throw new Error('No stages found for life story');
      }

      // Combine stages into raw content
      rawContent = stages
        .map((stage) => `${stage.stageName}: ${stage.content || ''}`)
        .join('\n\n');
    } else {
      // Creative story - use the content field
      if (!story.content) {
        throw new Error('No content found for creative story');
      }
      rawContent = story.content;
    }

    await job.updateProgress(30);

    // Calculate target word count based on pages
    // Assuming ~250 words per page
    const numberOfPages = generationConfig.numberOfPages || 12;
    const targetWordCount = numberOfPages * 250;

    // Generate complete story using Gemini with page constraint
    let generatedStory = await geminiService.generateStoryFromContent(
      rawContent,
      {
        tone: generationConfig.tone || 'narrative',
        targetAudience: generationConfig.targetAudience || 'adults',
        numberOfPages,
        targetWordCount,
      }
    );

    await job.updateProgress(60);

    // Improve grammar if requested
    if (generationConfig.improveGrammar) {
      generatedStory = await geminiService.improveGrammar(
        generatedStory,
        'en'
      );
    }

    await job.updateProgress(80);

    // Update story with generated content
    await db
      .update(stories)
      .set({
        content: generatedStory,
        status: 'completed',
        generationConfig: generationConfig as any,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    await job.updateProgress(90);

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'completed',
        result: { 
          generatedStory: true,
          wordCount: generatedStory.split(/\s+/).length,
          pages: numberOfPages,
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await job.updateProgress(100);

    return {
      success: true,
      data: {
        storyId,
        generatedLength: generatedStory.length,
        wordCount: generatedStory.split(/\s+/).length,
        pages: numberOfPages,
      },
    };
  } catch (error) {
    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    throw error;
  }
}
