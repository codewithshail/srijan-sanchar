import { Worker, Job } from 'bullmq';
import { connection, JobData, JobResult } from './queue';
import { processStoryGeneration } from './processors/story-generation';
import { processImageGeneration } from './processors/image-generation';
import { processAudioGeneration } from './processors/audio-generation';

// Story Generation Worker
export const storyGenerationWorker = new Worker<JobData, JobResult>(
  'story-generation',
  async (job: Job<JobData>) => {
    console.log(`Processing story generation job ${job.id} for story ${job.data.storyId}`);
    return await processStoryGeneration(job);
  },
  {
    connection,
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
    console.log(`Processing image generation job ${job.id} for story ${job.data.storyId}`);
    return await processImageGeneration(job);
  },
  {
    connection,
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
    console.log(`Processing audio generation job ${job.id} for story ${job.data.storyId}`);
    return await processAudioGeneration(job);
  },
  {
    connection,
    concurrency: 2, // Process 2 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // per minute
    },
  }
);

// Event handlers for all workers
const workers = [storyGenerationWorker, imageGenerationWorker, audioGenerationWorker];

workers.forEach((worker) => {
  worker.on('completed', (job: Job<JobData, JobResult>) => {
    console.log(`Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job: Job<JobData> | undefined, err: Error) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err: Error) => {
    console.error('Worker error:', err);
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
