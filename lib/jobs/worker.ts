import { Worker, Job } from 'bullmq';
import { getConnection, JobData, JobResult, JobType } from './queue';
import { processStoryGeneration } from './processors/story-generation';
import { processImageGeneration } from './processors/image-generation';
import { processAudioGeneration } from './processors/audio-generation';
import { sendJobNotification, NotificationPayload } from './notifications';

/**
 * Send notification for completed/failed job
 */
async function notifyJobCompletion(
  job: Job<JobData, JobResult>,
  jobType: JobType,
  status: 'completed' | 'failed',
  result?: JobResult,
  error?: string
): Promise<void> {
  try {
    // Use dbJobId (database UUID) if available, otherwise skip notification storage
    const dbJobId = job.data.dbJobId;
    if (!dbJobId) {
      console.warn(`[WORKER] No dbJobId for job ${job.id}, skipping in-app notification storage`);
      return;
    }

    const payload: NotificationPayload = {
      userId: '', // Will be resolved from story
      storyId: job.data.storyId,
      jobId: dbJobId, // Use database job ID, not BullMQ job ID
      jobType: jobType as NotificationPayload['jobType'],
      status,
      result: result?.data as Record<string, unknown>,
      error: error || result?.error,
    };

    await sendJobNotification(payload);
  } catch (notifyError) {
    console.error(`[WORKER] Failed to send notification for job ${job.id}:`, notifyError);
    // Don't throw - notification failure shouldn't affect job status
  }
}

// Story Generation Worker
export const storyGenerationWorker = new Worker<JobData, JobResult>(
  'story-generation',
  async (job: Job<JobData>) => {
    console.log(`[WORKER] Processing story generation job ${job.id} for story ${job.data.storyId}`);
    const startTime = Date.now();

    try {
      const result = await processStoryGeneration(job);
      const duration = Date.now() - startTime;
      console.log(`[WORKER] Story generation job ${job.id} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WORKER] Story generation job ${job.id} failed after ${duration}ms:`, error);
      throw error;
    }
  },
  {
    connection: getConnection(),
    concurrency: 2, // Process 2 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per minute
    },
  }
);

// Image Generation Worker
export const imageGenerationWorker = new Worker<JobData, JobResult>(
  'image-generation',
  async (job: Job<JobData>) => {
    console.log(`[WORKER] Processing image generation job ${job.id} for story ${job.data.storyId}`);
    const startTime = Date.now();

    try {
      const result = await processImageGeneration(job);
      const duration = Date.now() - startTime;
      console.log(`[WORKER] Image generation job ${job.id} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WORKER] Image generation job ${job.id} failed after ${duration}ms:`, error);
      throw error;
    }
  },
  {
    connection: getConnection(),
    concurrency: 1, // Process 1 job at a time (image generation is resource-intensive)
    limiter: {
      max: 5, // Max 5 jobs
      duration: 60000, // per minute
    },
  }
);

// Audio Generation Worker
export const audioGenerationWorker = new Worker<JobData, JobResult>(
  'audio-generation',
  async (job: Job<JobData>) => {
    console.log(`[WORKER] Processing audio generation job ${job.id} for story ${job.data.storyId}`);
    const startTime = Date.now();

    try {
      const result = await processAudioGeneration(job);
      const duration = Date.now() - startTime;
      console.log(`[WORKER] Audio generation job ${job.id} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[WORKER] Audio generation job ${job.id} failed after ${duration}ms:`, error);
      throw error;
    }
  },
  {
    connection: getConnection(),
    concurrency: 2, // Process 2 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per minute
    },
  }
);

// Map workers to their job types
const workerJobTypes: Map<Worker<JobData, JobResult>, JobType> = new Map([
  [storyGenerationWorker, JobType.STORY_GENERATION],
  [imageGenerationWorker, JobType.IMAGE_GENERATION],
  [audioGenerationWorker, JobType.AUDIO_GENERATION],
]);

// Event handlers for all workers
const workers = [storyGenerationWorker, imageGenerationWorker, audioGenerationWorker];

workers.forEach((worker) => {
  const jobType = workerJobTypes.get(worker)!;

  worker.on('completed', async (job: Job<JobData, JobResult>, result: JobResult) => {
    console.log(`[WORKER] Job ${job.id} (${jobType}) completed successfully`);

    // Send completion notification
    await notifyJobCompletion(job, jobType, 'completed', result);
  });

  worker.on('failed', async (job: Job<JobData> | undefined, err: Error) => {
    console.error(`[WORKER] Job ${job?.id} (${jobType}) failed:`, err.message);

    // Send failure notification (only on final failure, not retries)
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await notifyJobCompletion(job, jobType, 'failed', undefined, err.message);
    }
  });

  worker.on('error', (err: Error) => {
    console.error(`[WORKER] Worker error (${jobType}):`, err);
  });

  worker.on('progress', (job, progress) => {
    let progressValue = 0;
    if (typeof progress === 'number') {
      progressValue = progress;
    } else if (typeof progress === 'object' && progress !== null) {
      progressValue = (progress as Record<string, unknown>).progress as number || 0;
    }
    console.log(`[WORKER] Job ${job.id} (${jobType}) progress: ${progressValue}%`);
  });

  worker.on('stalled', (jobId: string) => {
    console.warn(`[WORKER] Job ${jobId} (${jobType}) stalled - will be retried`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
});

console.log('Workers started and listening for jobs...');
