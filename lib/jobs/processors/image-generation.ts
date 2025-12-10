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

/**
 * Progress stages for image generation
 */
const PROGRESS_STAGES = {
  INITIALIZING: { progress: 5, message: 'Initializing image generation...' },
  FETCHING_STORY: { progress: 10, message: 'Fetching story content...' },
  GENERATING_PROMPTS: { progress: 25, message: 'Creating image prompts...' },
  GENERATING_IMAGES: { progress: 40, message: 'Generating images...' },
  UPLOADING: { progress: 85, message: 'Uploading images...' },
  INTEGRATING: { progress: 95, message: 'Integrating images into story...' },
  COMPLETE: { progress: 100, message: 'Image generation complete!' },
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
  console.log(`[IMAGE_GENERATION] ${message} (${finalProgress}%)`);
}

export interface ImageGenerationConfig {
  numberOfImages?: number;
  imageStyle?: 'realistic' | 'artistic' | 'minimalist';
  aspectRatio?: '16:9' | '4:3' | '1:1';
  targetAudience?: 'children' | 'adults' | 'all';
  /** Whether to optimize for print (higher quality) */
  optimizeForPrint?: boolean;
  /** Whether to generate thumbnails */
  generateThumbnails?: boolean;
}

/**
 * Generated image result with all versions
 */
interface GeneratedImageResult {
  url: string;
  thumbnailUrl?: string;
  smallUrl?: string;
  mediumUrl?: string;
  largeUrl?: string;
  bannerUrl?: string;
  printUrl?: string;
  blurPlaceholder?: string;
  prompt: string;
  index: number;
  isFallback: boolean;
  error?: string;
}

/**
 * Process image generation job
 * Generates contextual images for stories with optimization for web and print
 */
export async function processImageGeneration(
  job: Job<JobData>
): Promise<JobResult> {
  const { storyId, config } = job.data;
  const imageConfig = config as ImageGenerationConfig;
  const startTime = Date.now();

  const generatedImages: GeneratedImageResult[] = [];
  const failedImages: { index: number; prompt: string; error: string }[] = [];

  try {
    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'processing',
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await updateProgress(job, 'INITIALIZING');

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

    await updateProgress(job, 'FETCHING_STORY');

    // Generate image prompts from story content with style and audience options
    const numberOfImages = imageConfig.numberOfImages || 3;
    const imageStyle = imageConfig.imageStyle || 'realistic';
    const targetAudience = imageConfig.targetAudience || 'adults';

    console.log(`[IMAGE_GENERATION] Generating ${numberOfImages} prompts for story ${storyId}`);

    const prompts = await geminiService.generateImagePrompts(
      story.content,
      numberOfImages,
      {
        style: imageStyle,
        targetAudience,
      }
    );

    console.log(`[IMAGE_GENERATION] Generated ${prompts.length} prompts`);
    await updateProgress(job, 'GENERATING_PROMPTS');

    // Determine optimization settings
    const optimizationTarget = imageConfig.optimizeForPrint ? 'print' : 'web';
    const aspectRatio = imageConfig.aspectRatio || '16:9';

    // Generate images using Imagen-4 with retry and fallback
    const progressPerImage = 45 / prompts.length; // 40% to 85%

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      console.log(`[IMAGE_GENERATION] Processing image ${i + 1}/${prompts.length}`);

      try {
        // Generate image with fallback handling
        const imageResult = await imagenService.generateImageWithFallback(
          prompt,
          imageStyle,
          aspectRatio
        );

        let imageUrl: string;
        let thumbnailUrl: string | undefined;
        let printUrl: string | undefined;
        let isFallback = false;

        if (imageResult.imageBytes && imagenService.validateImageBytes(imageResult.imageBytes)) {
          // Upload to Cloudinary with optimization (includes all size variants and blur placeholder)
          const uploadResult = await cloudinaryService.uploadImageWithVersions(
            imageResult.imageBytes,
            storyId,
            i,
            {
              target: optimizationTarget,
              generateThumbnail: imageConfig.generateThumbnails !== false,
              generateBlurPlaceholder: true,
            }
          );

          imageUrl = uploadResult.url;
          thumbnailUrl = uploadResult.thumbnailUrl;
          printUrl = uploadResult.printUrl;

          console.log(`[IMAGE_GENERATION] Uploaded image ${i + 1} to ${imageUrl}`);

          generatedImages.push({
            url: imageUrl,
            thumbnailUrl,
            smallUrl: uploadResult.smallUrl,
            mediumUrl: uploadResult.mediumUrl,
            largeUrl: uploadResult.largeUrl,
            bannerUrl: uploadResult.bannerUrl,
            printUrl,
            blurPlaceholder: uploadResult.blurPlaceholder,
            prompt,
            index: i,
            isFallback: false,
            error: undefined,
          });
        } else {
          // Use placeholder for failed generation
          imageUrl = imagenService.getPlaceholderImageUrl(prompt, 1200, 800);
          thumbnailUrl = imagenService.getPlaceholderImageUrl(prompt, 400, 300);
          isFallback = true;

          console.log(`[IMAGE_GENERATION] Using placeholder for image ${i + 1}`);
          
          failedImages.push({
            index: i,
            prompt,
            error: imageResult.error || 'Image generation returned empty result',
          });

          generatedImages.push({
            url: imageUrl,
            thumbnailUrl,
            smallUrl: imagenService.getPlaceholderImageUrl(prompt, 400, 300),
            mediumUrl: imagenService.getPlaceholderImageUrl(prompt, 800, 600),
            largeUrl: imageUrl,
            bannerUrl: imagenService.getPlaceholderImageUrl(prompt, 1920, 1080),
            printUrl: imageUrl,
            blurPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==',
            prompt,
            index: i,
            isFallback: true,
            error: imageResult.error,
          });
        }

        // Update progress for each image
        const currentProgress = 40 + (i + 1) * progressPerImage;
        await updateProgress(job, 'GENERATING_IMAGES', Math.round(currentProgress));
      } catch (error) {
        console.error(`[IMAGE_GENERATION] Failed to generate image ${i}:`, error);
        
        // Add placeholder for failed image
        const placeholderUrl = imagenService.getPlaceholderImageUrl(prompt, 1200, 800);
        
        generatedImages.push({
          url: placeholderUrl,
          thumbnailUrl: imagenService.getPlaceholderImageUrl(prompt, 400, 300),
          smallUrl: imagenService.getPlaceholderImageUrl(prompt, 400, 300),
          mediumUrl: imagenService.getPlaceholderImageUrl(prompt, 800, 600),
          largeUrl: placeholderUrl,
          bannerUrl: imagenService.getPlaceholderImageUrl(prompt, 1920, 1080),
          printUrl: placeholderUrl,
          blurPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==',
          prompt,
          index: i,
          isFallback: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        failedImages.push({
          index: i,
          prompt,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await updateProgress(job, 'UPLOADING');

    // Check if we have at least one successful image
    const successfulImages = generatedImages.filter((img) => !img.isFallback);
    
    if (successfulImages.length === 0 && generatedImages.length > 0) {
      console.warn(`[IMAGE_GENERATION] All images are fallbacks for story ${storyId}`);
    }

    // Update story with the best available banner image
    const bannerImage = successfulImages[0] || generatedImages[0];
    
    if (bannerImage) {
      await db
        .update(stories)
        .set({
          bannerImageUrl: bannerImage.url,
          thumbnailImageUrl: bannerImage.thumbnailUrl || bannerImage.url,
          updatedAt: new Date(),
        })
        .where(eq(stories.id, storyId));

      // Save image metadata (upsert to handle existing records)
      try {
        await db.insert(images).values({
          storyId,
          url: bannerImage.url,
          prompt: bannerImage.prompt,
        }).onConflictDoUpdate({
          target: images.storyId,
          set: {
            url: bannerImage.url,
            prompt: bannerImage.prompt,
          },
        });
      } catch (dbError) {
        console.error('[IMAGE_GENERATION] Failed to save image metadata:', dbError);
        // Non-fatal error, continue
      }
    }

    // Determine final status
    const allFailed = generatedImages.every((img) => img.isFallback);
    const partialSuccess = failedImages.length > 0 && !allFailed;

    // Integrate images into the story content
    let imagesIntegrated = false;
    if (successfulImages.length > 0) {
      await updateProgress(job, 'INTEGRATING');
      try {
        const { integrateImagesIntoStory } = await import('./story-generation');
        const integrationResult = await integrateImagesIntoStory(storyId, generatedImages);
        
        if (!integrationResult.success) {
          console.warn(`[IMAGE_GENERATION] Image integration warning: ${integrationResult.error}`);
        } else {
          console.log(`[IMAGE_GENERATION] Successfully integrated images into story ${storyId}`);
          imagesIntegrated = true;
        }
      } catch (integrationError) {
        console.error('[IMAGE_GENERATION] Failed to integrate images into story:', integrationError);
        // Non-fatal - images are still saved
      }
    }

    const duration = Date.now() - startTime;

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'completed',
        result: {
          imagesGenerated: generatedImages.length,
          successfulImages: successfulImages.length,
          failedImages: failedImages.length,
          images: generatedImages,
          failures: failedImages,
          partialSuccess,
          allFallbacks: allFailed,
          imagesIntegrated,
          duration,
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await updateProgress(job, 'COMPLETE');

    console.log(`[IMAGE_GENERATION] Job completed for story ${storyId} in ${duration}ms`);

    return {
      success: true,
      data: {
        storyId,
        imagesGenerated: generatedImages.length,
        successfulImages: successfulImages.length,
        failedImages: failedImages.length,
        images: generatedImages,
        failures: failedImages,
        partialSuccess,
        imagesIntegrated,
      },
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[IMAGE_GENERATION] Job failed for story ${storyId} after ${duration}ms:`, error);

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        result: {
          imagesGenerated: generatedImages.length,
          images: generatedImages,
          failures: failedImages,
          duration,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts || 4,
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    throw error;
  }
}

/**
 * Regenerate a single failed image
 */
export async function regenerateSingleImage(
  storyId: string,
  imageIndex: number,
  prompt: string,
  style: string = 'realistic'
): Promise<GeneratedImageResult> {
  try {
    const imageResult = await imagenService.generateImageWithFallback(
      prompt,
      style,
      '16:9'
    );

    if (imageResult.imageBytes && imagenService.validateImageBytes(imageResult.imageBytes)) {
      const uploadResult = await cloudinaryService.uploadImageWithVersions(
        imageResult.imageBytes,
        storyId,
        imageIndex,
        { target: 'web', generateThumbnail: true, generateBlurPlaceholder: true }
      );

      return {
        url: uploadResult.url,
        thumbnailUrl: uploadResult.thumbnailUrl,
        smallUrl: uploadResult.smallUrl,
        mediumUrl: uploadResult.mediumUrl,
        largeUrl: uploadResult.largeUrl,
        bannerUrl: uploadResult.bannerUrl,
        printUrl: uploadResult.printUrl,
        blurPlaceholder: uploadResult.blurPlaceholder,
        prompt,
        index: imageIndex,
        isFallback: false,
      };
    }

    return {
      url: imagenService.getPlaceholderImageUrl(prompt, 1200, 800),
      thumbnailUrl: imagenService.getPlaceholderImageUrl(prompt, 400, 300),
      smallUrl: imagenService.getPlaceholderImageUrl(prompt, 400, 300),
      mediumUrl: imagenService.getPlaceholderImageUrl(prompt, 800, 600),
      largeUrl: imagenService.getPlaceholderImageUrl(prompt, 1200, 800),
      bannerUrl: imagenService.getPlaceholderImageUrl(prompt, 1920, 1080),
      printUrl: imagenService.getPlaceholderImageUrl(prompt, 1200, 800),
      blurPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==',
      prompt,
      index: imageIndex,
      isFallback: true,
      error: imageResult.error || 'Generation failed',
    };
  } catch (error) {
    return {
      url: imagenService.getPlaceholderImageUrl(prompt, 1200, 800),
      thumbnailUrl: imagenService.getPlaceholderImageUrl(prompt, 400, 300),
      smallUrl: imagenService.getPlaceholderImageUrl(prompt, 400, 300),
      mediumUrl: imagenService.getPlaceholderImageUrl(prompt, 800, 600),
      largeUrl: imagenService.getPlaceholderImageUrl(prompt, 1200, 800),
      bannerUrl: imagenService.getPlaceholderImageUrl(prompt, 1920, 1080),
      printUrl: imagenService.getPlaceholderImageUrl(prompt, 1200, 800),
      blurPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==',
      prompt,
      index: imageIndex,
      isFallback: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
