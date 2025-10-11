import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { generationJobs, stories, images } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { GeminiService } from '@/lib/ai/gemini-service';
import { ImagenService } from '@/lib/ai/imagen-service';
import { cloudinaryService } from '@/lib/storage/cloudinary';
import { JobData, JobResult } from '../queue';

const geminiService = new GeminiService();
const imagenService = new ImagenService();

export interface ImageGenerationConfig {
  numberOfImages?: number;
  imageStyle?: 'realistic' | 'artistic' | 'minimalist';
  aspectRatio?: '16:9' | '4:3' | '1:1';
}

/**
 * Process image generation job
 */
export async function processImageGeneration(
  job: Job<JobData>
): Promise<JobResult> {
  const { storyId, config } = job.data;
  const imageConfig = config as ImageGenerationConfig;

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

    if (!story.content) {
      throw new Error('Story has no content to generate images from');
    }

    await job.updateProgress(20);

    // Generate image prompts from story content
    const numberOfImages = imageConfig.numberOfImages || 3;
    const prompts = await geminiService.generateImagePrompts(
      story.content,
      numberOfImages
    );

    await job.updateProgress(40);

    // Generate images using Imagen-4
    const generatedImages = [];
    const progressPerImage = 50 / prompts.length;

    for (let i = 0; i < prompts.length; i++) {
      try {
        const imageData = await imagenService.generateImage(
          prompts[i],
          imageConfig.imageStyle || 'realistic',
          imageConfig.aspectRatio || '16:9'
        );

        // Upload to Cloudinary
        const imageUrl = await cloudinaryService.uploadImage(
          imageData.imageBytes,
          storyId,
          i
        );

        generatedImages.push({
          url: imageUrl,
          prompt: prompts[i],
          index: i,
        });

        await job.updateProgress(40 + (i + 1) * progressPerImage);
      } catch (error) {
        console.error(`Failed to generate image ${i}:`, error);
        // Continue with other images even if one fails
      }
    }

    if (generatedImages.length === 0) {
      throw new Error('Failed to generate any images');
    }

    await job.updateProgress(90);

    // Save first image as story banner
    if (generatedImages.length > 0) {
      await db
        .update(stories)
        .set({
          bannerImageUrl: generatedImages[0].url,
          thumbnailImageUrl: generatedImages[0].url,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      // Save image metadata
      await db.insert(images).values({
        storyId,
        url: generatedImages[0].url,
        prompt: generatedImages[0].prompt,
      });
    }

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'completed',
        result: { 
          imagesGenerated: generatedImages.length,
          images: generatedImages 
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await job.updateProgress(100);

    return {
      success: true,
      data: {
        storyId,
        imagesGenerated: generatedImages.length,
        images: generatedImages,
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
