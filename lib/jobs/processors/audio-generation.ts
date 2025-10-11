import { Job } from "bullmq";
import { db } from "@/lib/db";
import { generationJobs, stories, audioChapters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sarvamTTS, type TTSRequest } from "@/lib/ai/sarvam-tts";
import { cloudinaryService } from "@/lib/storage/cloudinary";
import { JobData, JobResult } from "../queue";

export interface AudioGenerationConfig {
  language?: string;
  chapterDuration?: number; // in seconds
  speaker?: string;
}

/**
 * Split text into chapters based on target duration
 * Assumes ~150 words per minute reading speed
 */
function splitIntoChapters(
  text: string,
  targetDuration: number = 60
): Array<{
  text: string;
  startPos: number;
  endPos: number;
  estimatedDuration: number;
}> {
  const wordsPerMinute = 150;
  const wordsPerSecond = wordsPerMinute / 60;
  const targetWords = Math.floor(targetDuration * wordsPerSecond);

  // Split by paragraphs first
  const paragraphs = text.split(/\n\n+/);
  const chapters: Array<{
    text: string;
    startPos: number;
    endPos: number;
    estimatedDuration: number;
  }> = [];

  let currentChapter = "";
  let currentWordCount = 0;
  let startPos = 0;
  let currentPos = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/);
    const paragraphWordCount = words.length;

    // If adding this paragraph exceeds target, save current chapter
    if (currentWordCount + paragraphWordCount > targetWords && currentChapter) {
      const estimatedDuration = Math.ceil(currentWordCount / wordsPerSecond);
      chapters.push({
        text: currentChapter.trim(),
        startPos,
        endPos: currentPos,
        estimatedDuration,
      });

      currentChapter = paragraph + "\n\n";
      currentWordCount = paragraphWordCount;
      startPos = currentPos;
    } else {
      currentChapter += paragraph + "\n\n";
      currentWordCount += paragraphWordCount;
    }

    currentPos += paragraph.length + 2; // +2 for \n\n
  }

  // Add remaining content as last chapter
  if (currentChapter.trim()) {
    const estimatedDuration = Math.ceil(currentWordCount / wordsPerSecond);
    chapters.push({
      text: currentChapter.trim(),
      startPos,
      endPos: currentPos,
      estimatedDuration,
    });
  }

  return chapters;
}

/**
 * Upload audio to Cloudinary storage
 */
async function uploadAudioToStorage(
  audioData: ArrayBuffer,
  storyId: string,
  chapterIndex: number,
  language: string
): Promise<string> {
  return await cloudinaryService.uploadAudio(
    audioData,
    storyId,
    chapterIndex,
    language
  );
}

/**
 * Process audio generation job
 */
export async function processAudioGeneration(
  job: Job<JobData>
): Promise<JobResult> {
  const { storyId, config } = job.data;
  const audioConfig = config as AudioGenerationConfig;

  try {
    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: "processing",
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

    if (!story.content) {
      throw new Error("Story has no content to generate audio from");
    }

    await job.updateProgress(20);

    // Split story into chapters
    const chapterDuration = audioConfig.chapterDuration || 60; // 1 minute default
    const chapters = splitIntoChapters(story.content, chapterDuration);

    await job.updateProgress(30);

    // Generate audio for each chapter
    const language = audioConfig.language || "en-IN";
    const speaker = audioConfig.speaker || "anushka";
    const generatedChapters = [];
    const progressPerChapter = 60 / chapters.length;

    for (let i = 0; i < chapters.length; i++) {
      try {
        // Generate audio using Sarvam TTS
        const ttsRequest: TTSRequest = {
          text: chapters[i].text,
          language,
          speaker,
        };

        const result = await sarvamTTS.generateAudio(ttsRequest);

        if (result.error || !result.audioData) {
          throw new Error(result.error || "No audio data received");
        }

        // Upload to storage
        const audioUrl = await uploadAudioToStorage(
          result.audioData,
          storyId,
          i,
          language
        );

        // Save chapter metadata to database
        await db.insert(audioChapters).values({
          storyId,
          chapterIndex: i,
          language,
          audioUrl,
          duration: chapters[i].estimatedDuration,
          startPosition: chapters[i].startPos,
          endPosition: chapters[i].endPos,
        });

        generatedChapters.push({
          chapterIndex: i,
          audioUrl,
          duration: chapters[i].estimatedDuration,
        });

        await job.updateProgress(30 + (i + 1) * progressPerChapter);
      } catch (error) {
        console.error(`Failed to generate audio for chapter ${i}:`, error);
        // Continue with other chapters even if one fails
      }
    }

    if (generatedChapters.length === 0) {
      throw new Error("Failed to generate any audio chapters");
    }

    await job.updateProgress(90);

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: "completed",
        result: {
          chaptersGenerated: generatedChapters.length,
          totalChapters: chapters.length,
          language,
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await job.updateProgress(100);

    return {
      success: true,
      data: {
        storyId,
        chaptersGenerated: generatedChapters.length,
        totalChapters: chapters.length,
        language,
      },
    };
  } catch (error) {
    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    throw error;
  }
}
