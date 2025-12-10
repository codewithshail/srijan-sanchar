import { Job } from "bullmq";
import { db } from "@/lib/db";
import { generationJobs, stories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { audioChapterService, type AudioChapterConfig } from "@/lib/audio/audio-chapter-service";
import { JobData, JobResult } from "../queue";

export interface AudioGenerationConfig extends AudioChapterConfig {
  /** Target duration per chapter in seconds */
  chapterDuration?: number;
}

/**
 * Progress stages for audio generation
 */
const PROGRESS_STAGES = {
  INITIALIZING: { progress: 5, message: 'Initializing audio generation...' },
  FETCHING_STORY: { progress: 10, message: 'Fetching story content...' },
  SPLITTING_CHAPTERS: { progress: 15, message: 'Splitting into chapters...' },
  GENERATING_AUDIO: { progress: 20, message: 'Generating audio...' },
  SAVING: { progress: 95, message: 'Saving audio chapters...' },
  COMPLETE: { progress: 100, message: 'Audio generation complete!' },
};

/**
 * Update job progress with message
 */
async function updateProgress(
  job: Job<JobData>,
  stage: keyof typeof PROGRESS_STAGES,
  customProgress?: number
): Promise<void> {
  const { progress, message } = PROGRESS_STAGES[stage];
  const finalProgress = customProgress ?? progress;
  await job.updateProgress({ progress: finalProgress, message, stage });
  console.log(`[AUDIO_GENERATION] ${message} (${finalProgress}%)`);
}

/**
 * Process audio generation job
 * Uses AudioChapterService for chapter splitting and audio generation
 * 
 * Requirements: 8.2, 8.3
 */
export async function processAudioGeneration(
  job: Job<JobData>
): Promise<JobResult> {
  const { storyId, config } = job.data;
  const audioConfig = config as AudioGenerationConfig;
  const startTime = Date.now();

  try {
    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await updateProgress(job, 'INITIALIZING');

    // Verify story exists
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      throw new Error(`Story ${storyId} not found`);
    }

    if (!story.content) {
      throw new Error("Story has no content to generate audio from");
    }

    await updateProgress(job, 'FETCHING_STORY');

    // Prepare config for audio chapter service
    const chapterConfig: AudioChapterConfig = {
      targetDuration: audioConfig.chapterDuration || audioConfig.targetDuration || 60,
      language: audioConfig.language || "en-IN",
      speaker: audioConfig.speaker || "anushka",
      pitch: audioConfig.pitch,
      pace: audioConfig.pace,
    };

    // Generate all chapters using the audio chapter service
    const result = await audioChapterService.generateAllChapters(
      storyId,
      chapterConfig,
      async (progress, message) => {
        // Map service progress to job progress (20-95 range)
        const mappedProgress = 20 + Math.round((progress / 100) * 75);
        await job.updateProgress({ progress: mappedProgress, message, stage: 'GENERATING_AUDIO' });
        console.log(`[AUDIO_GENERATION] ${message} (${mappedProgress}%)`);
      }
    );

    await updateProgress(job, 'SAVING');

    const duration = Date.now() - startTime;

    if (!result.success || result.chapters.length === 0) {
      throw new Error("Failed to generate any audio chapters");
    }

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: "completed",
        result: {
          chaptersGenerated: result.chapters.length,
          totalChapters: result.chapters.length + result.failedChapters.length,
          failedChapters: result.failedChapters.length,
          failures: result.failedChapters,
          language: result.language,
          speaker: result.speaker,
          totalAudioDuration: result.totalDuration,
          processingDuration: duration,
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await updateProgress(job, 'COMPLETE');

    console.log(`[AUDIO_GENERATION] Job completed for story ${storyId} in ${duration}ms`);

    return {
      success: true,
      data: {
        storyId,
        chaptersGenerated: result.chapters.length,
        totalChapters: result.chapters.length + result.failedChapters.length,
        failedChapters: result.failedChapters.length,
        language: result.language,
        speaker: result.speaker,
        totalAudioDuration: result.totalDuration,
      },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[AUDIO_GENERATION] Job failed for story ${storyId} after ${duration}ms:`, error);

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        result: {
          duration,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts || 3,
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    throw error;
  }
}
