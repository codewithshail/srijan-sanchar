import { Job } from 'bullmq';
import { db } from '@/lib/db';
import { generationJobs, stories, storyStages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { GeminiService } from '@/lib/ai/gemini-service';
import { JobData, JobResult, JobType } from '../queue';

const geminiService = new GeminiService();

/**
 * Progress stages for story generation
 */
const PROGRESS_STAGES = {
  INITIALIZING: { progress: 5, message: 'Initializing story generation...' },
  FETCHING_STORY: { progress: 10, message: 'Fetching story data...' },
  ANALYZING_CONTENT: { progress: 20, message: 'Analyzing your content...' },
  GENERATING_STORY: { progress: 50, message: 'Generating your story...' },
  IMPROVING_GRAMMAR: { progress: 65, message: 'Improving grammar...' },
  FORMATTING: { progress: 70, message: 'Formatting story...' },
  QUEUING_IMAGES: { progress: 80, message: 'Preparing image generation...' },
  SAVING: { progress: 90, message: 'Saving your story...' },
  COMPLETE: { progress: 100, message: 'Story generation complete!' },
};

/**
 * Update job progress with message
 */
async function updateProgress(
  job: Job<JobData>,
  stage: keyof typeof PROGRESS_STAGES
): Promise<void> {
  const { progress, message } = PROGRESS_STAGES[stage];
  await job.updateProgress({ progress, message, stage });
  console.log(`[STORY_GENERATION] ${message} (${progress}%)`);
}

export interface StoryGenerationConfig {
  includeAIImages?: boolean;
  numberOfPages?: number;
  improveGrammar?: boolean;
  tone?: 'formal' | 'casual' | 'poetic' | 'narrative';
  targetAudience?: 'children' | 'adults' | 'all';
  imageStyle?: 'realistic' | 'artistic' | 'minimalist';
}

/**
 * Life stage information for story generation
 */
interface LifeStage {
  stageName: string;
  content: string;
  stageIndex: number;
}



/**
 * Format story content in markdown with proper structure
 */
function formatStoryAsMarkdown(
  content: string,
  title: string | null,
  _config: StoryGenerationConfig
): string {
  let formatted = '';
  
  // Add title if available
  if (title) {
    formatted += `# ${title}\n\n`;
  }
  
  // The content should already be in markdown format from Gemini
  // But we ensure proper formatting
  formatted += content;
  
  // Ensure proper paragraph spacing
  formatted = formatted
    .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
    .replace(/([.!?])\s*\n(?=[A-Z])/g, '$1\n\n') // Add paragraph breaks after sentences
    .trim();
  
  return formatted;
}

/**
 * Insert images optimally into the story content
 */
function insertImagesIntoStory(
  storyContent: string,
  imageUrls: string[],
  imageCaptions: string[]
): string {
  if (!imageUrls || imageUrls.length === 0) {
    return storyContent;
  }
  
  // Split story into sections (by headings or paragraphs)
  const sections = storyContent.split(/(?=^##\s)/m);
  
  if (sections.length <= 1) {
    // No clear sections, split by paragraphs
    const paragraphs = storyContent.split(/\n\n+/);
    const paragraphsPerImage = Math.ceil(paragraphs.length / (imageUrls.length + 1));
    
    const result: string[] = [];
    let imageIndex = 0;
    
    for (let i = 0; i < paragraphs.length; i++) {
      result.push(paragraphs[i]);
      
      // Insert image after every N paragraphs (but not at the very end)
      if (
        imageIndex < imageUrls.length &&
        (i + 1) % paragraphsPerImage === 0 &&
        i < paragraphs.length - 1
      ) {
        const caption = imageCaptions[imageIndex] || '';
        result.push(`\n\n![${caption}](${imageUrls[imageIndex]})\n*${caption}*\n`);
        imageIndex++;
      }
    }
    
    return result.join('\n\n');
  }
  
  // Distribute images across sections
  let imageIndex = 0;
  
  const result = sections.map((section, sectionIndex) => {
    // Don't add image to the first section (usually title/intro)
    if (sectionIndex === 0 || imageIndex >= imageUrls.length) {
      return section;
    }
    
    // Add image at the beginning of the section (after the heading)
    const headingMatch = section.match(/^(##\s+[^\n]+\n)/);
    if (headingMatch) {
      const heading = headingMatch[1];
      const rest = section.slice(heading.length);
      const caption = imageCaptions[imageIndex] || '';
      const imageMarkdown = `\n![${caption}](${imageUrls[imageIndex]})\n*${caption}*\n`;
      imageIndex++;
      return heading + imageMarkdown + rest;
    }
    
    return section;
  });
  
  return result.join('');
}

/**
 * Get tone-specific system prompt additions
 */
function getToneGuidance(tone: string): string {
  const toneGuides: Record<string, string> = {
    formal: 'Use formal language, proper grammar, and a professional tone. Avoid colloquialisms and maintain a dignified narrative voice.',
    casual: 'Use conversational language, contractions, and a friendly tone. Make the reader feel like they are hearing from a friend.',
    poetic: 'Use lyrical language, metaphors, and vivid imagery. Create an emotional and artistic narrative with beautiful prose.',
    narrative: 'Use classic storytelling techniques with a balanced tone. Create engaging narrative flow with proper pacing and character development.',
  };
  
  return toneGuides[tone] || toneGuides.narrative;
}

/**
 * Get audience-specific content guidance
 */
function getAudienceGuidance(audience: string): string {
  const audienceGuides: Record<string, string> = {
    children: 'Use simple vocabulary, short sentences, and age-appropriate themes. Include wonder and positive messages.',
    adults: 'Use sophisticated vocabulary and complex themes. Include nuanced emotions and mature perspectives.',
    all: 'Use accessible language that appeals to all ages. Balance simplicity with depth.',
  };
  
  return audienceGuides[audience] || audienceGuides.all;
}

/**
 * Process story generation job
 * Generates a complete story with proper formatting, tone adjustments, and optional images
 */
export async function processStoryGeneration(
  job: Job<JobData>
): Promise<JobResult> {
  const { storyId, config } = job.data;
  const generationConfig = config as StoryGenerationConfig;
  const startTime = Date.now();

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

    console.log(`[STORY_GENERATION] Processing story ${storyId} (type: ${story.storyType})`);
    await updateProgress(job, 'FETCHING_STORY');

    let rawContent: string;
    let lifeStages: LifeStage[] = [];

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

      // Filter stages with content
      lifeStages = stages
        .filter((stage) => stage.content && stage.content.trim().length > 0)
        .map((stage) => ({
          stageName: stage.stageName,
          content: stage.content || '',
          stageIndex: stage.stageIndex,
        }));

      if (lifeStages.length === 0) {
        throw new Error('No stages with content found for life story');
      }

      // Combine stages into raw content with clear structure
      rawContent = lifeStages
        .map((stage) => `## ${stage.stageName}\n\n${stage.content}`)
        .join('\n\n');
        
      console.log(`[STORY_GENERATION] Found ${lifeStages.length} stages with content`);
    } else {
      // Creative story - use the content field
      if (!story.content) {
        throw new Error('No content found for creative story');
      }
      rawContent = story.content;
      console.log(`[STORY_GENERATION] Using creative story content (${rawContent.length} chars)`);
    }

    await updateProgress(job, 'ANALYZING_CONTENT');

    // Calculate target word count based on pages
    // Assuming ~250 words per page
    const numberOfPages = generationConfig.numberOfPages || 12;
    const targetWordCount = numberOfPages * 250;
    const tone = generationConfig.tone || 'narrative';
    const targetAudience = generationConfig.targetAudience || 'adults';

    console.log(`[STORY_GENERATION] Generating ${numberOfPages} pages (~${targetWordCount} words) with ${tone} tone for ${targetAudience}`);

    // Generate complete story using Gemini with enhanced configuration
    let generatedStory = await geminiService.generateStoryFromContent(
      rawContent,
      {
        tone,
        targetAudience,
        numberOfPages,
        targetWordCount,
        toneGuidance: getToneGuidance(tone),
        audienceGuidance: getAudienceGuidance(targetAudience),
      }
    );

    console.log(`[STORY_GENERATION] Initial generation complete (${generatedStory.length} chars)`);
    await updateProgress(job, 'GENERATING_STORY');

    // Improve grammar if requested
    if (generationConfig.improveGrammar) {
      console.log('[STORY_GENERATION] Applying grammar improvements...');
      generatedStory = await geminiService.improveGrammar(
        generatedStory,
        'en'
      );
      console.log('[STORY_GENERATION] Grammar improvements applied');
    }

    await updateProgress(job, 'IMPROVING_GRAMMAR');

    // Format story as proper markdown
    generatedStory = formatStoryAsMarkdown(
      generatedStory,
      story.title,
      generationConfig
    );

    await updateProgress(job, 'FORMATTING');

    // Queue image generation if enabled
    let imageJobId: string | null = null;
    let numberOfImages = 0;
    
    if (generationConfig.includeAIImages) {
      try {
        const { JobQueue, JobType } = await import('../queue');
        
        // Calculate number of images (1 per 4 pages, minimum 1, maximum 6)
        numberOfImages = Math.min(Math.max(Math.ceil(numberOfPages / 4), 1), 6);
        
        console.log(`[STORY_GENERATION] Queuing ${numberOfImages} images for story ${storyId}`);
        
        // Create image generation job record
        await db
          .insert(generationJobs)
          .values({
            storyId,
            jobType: 'image_generation',
            status: 'pending',
            config: {
              numberOfImages,
              imageStyle: generationConfig.imageStyle || 'artistic',
              targetAudience: generationConfig.targetAudience || 'adults',
              generateThumbnails: true,
              storyContent: generatedStory.substring(0, 4000), // Pass story context for prompts
            },
          })
          .returning();

        // Add to queue
        imageJobId = await JobQueue.addJob(JobType.IMAGE_GENERATION, {
          storyId,
          config: {
            numberOfImages,
            imageStyle: generationConfig.imageStyle || 'artistic',
            targetAudience: generationConfig.targetAudience || 'adults',
            generateThumbnails: true,
          },
        });

        console.log(`[STORY_GENERATION] Queued image generation job ${imageJobId}`);
      } catch (imageError) {
        console.error('[STORY_GENERATION] Failed to queue image generation:', imageError);
        // Non-fatal - story generation still succeeded
      }
    }

    await updateProgress(job, 'QUEUING_IMAGES');

    // Calculate final word count
    const finalWordCount = generatedStory.split(/\s+/).length;
    
    // Update story with generated content
    await db
      .update(stories)
      .set({
        content: generatedStory,
        status: 'completed',
        generationConfig: generationConfig as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    console.log(`[STORY_GENERATION] Story saved (${finalWordCount} words)`);
    await updateProgress(job, 'SAVING');

    const duration = Date.now() - startTime;

    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'completed',
        result: { 
          generatedStory: true,
          wordCount: finalWordCount,
          characterCount: generatedStory.length,
          pages: numberOfPages,
          tone,
          targetAudience,
          grammarImproved: generationConfig.improveGrammar || false,
          imageGenerationQueued: !!imageJobId,
          imageJobId,
          numberOfImages,
          duration,
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, job.id!));

    await updateProgress(job, 'COMPLETE');

    console.log(`[STORY_GENERATION] Job completed successfully for story ${storyId} in ${duration}ms`);

    return {
      success: true,
      data: {
        storyId,
        generatedLength: generatedStory.length,
        wordCount: finalWordCount,
        pages: numberOfPages,
        tone,
        targetAudience,
        grammarImproved: generationConfig.improveGrammar || false,
        imageGenerationQueued: !!imageJobId,
        imageJobId,
        numberOfImages,
      },
      duration,
      childJobIds: imageJobId ? [imageJobId] : undefined,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[STORY_GENERATION] Job failed for story ${storyId} after ${duration}ms:`, error);
    
    // Update job status in database
    await db
      .update(generationJobs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
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


/**
 * Integrate generated images into an existing story
 * Called after image generation completes to update the story content
 */
export async function integrateImagesIntoStory(
  storyId: string,
  generatedImages: Array<{
    url: string;
    prompt: string;
    index: number;
    isFallback?: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the story
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story || !story.content) {
      return { success: false, error: 'Story not found or has no content' };
    }

    // Filter out fallback images
    const validImages = generatedImages.filter((img) => !img.isFallback && img.url);
    
    if (validImages.length === 0) {
      console.log(`[STORY_GENERATION] No valid images to integrate for story ${storyId}`);
      return { success: true };
    }

    // Extract image URLs and captions
    const imageUrls = validImages.map((img) => img.url);
    const imageCaptions = validImages.map((img) => {
      // Create a short caption from the prompt
      const caption = img.prompt.substring(0, 100);
      return caption.endsWith('.') ? caption : caption + '...';
    });

    // Insert images into the story
    const updatedContent = insertImagesIntoStory(
      story.content,
      imageUrls,
      imageCaptions
    );

    // Update the story with the new content
    await db
      .update(stories)
      .set({
        content: updatedContent,
        updatedAt: new Date(),
      })
      .where(eq(stories.id, storyId));

    console.log(`[STORY_GENERATION] Integrated ${validImages.length} images into story ${storyId}`);
    
    return { success: true };
  } catch (error) {
    console.error(`[STORY_GENERATION] Failed to integrate images:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Regenerate a story with new configuration
 */
export async function regenerateStory(
  storyId: string,
  config: StoryGenerationConfig
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    // Check if story exists
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return { success: false, error: 'Story not found' };
    }

    // Check for existing pending/processing jobs
    const existingJob = await db.query.generationJobs.findFirst({
      where: and(
        eq(generationJobs.storyId, storyId),
        eq(generationJobs.jobType, 'story_generation')
      ),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
    });

    if (existingJob && ['pending', 'processing'].includes(existingJob.status)) {
      return {
        success: false,
        error: 'Story generation already in progress',
        jobId: existingJob.id,
      };
    }

    // Create new job record
    const [jobRecord] = await db
      .insert(generationJobs)
      .values({
        storyId,
        jobType: 'story_generation',
        status: 'pending',
        config: config as Record<string, unknown>,
      })
      .returning();

    // Import and add to queue
    const { JobQueue, JobType } = await import('../queue');
    const queueJobId = await JobQueue.addJob(JobType.STORY_GENERATION, {
      storyId,
      config,
    });

    console.log(`[STORY_GENERATION] Queued regeneration job ${queueJobId} for story ${storyId}`);

    return {
      success: true,
      jobId: jobRecord.id,
    };
  } catch (error) {
    console.error(`[STORY_GENERATION] Failed to queue regeneration:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

