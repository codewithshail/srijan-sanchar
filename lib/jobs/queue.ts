import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection configuration
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Job type definitions
export enum JobType {
  STORY_GENERATION = 'story_generation',
  IMAGE_GENERATION = 'image_generation',
  AUDIO_GENERATION = 'audio_generation',
}

export interface JobData {
  storyId: string;
  config?: any;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Create queues for different job types
export const storyGenerationQueue = new Queue<JobData>('story-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 3600, // Keep for 24 hours
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 7 * 24 * 3600, // Keep for 7 days
    },
  },
});

export const imageGenerationQueue = new Queue<JobData>('image-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 3600,
    },
  },
});

export const audioGenerationQueue = new Queue<JobData>('audio-generation', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 500,
      age: 7 * 24 * 3600,
    },
  },
});

// Queue management class
export class JobQueue {
  /**
   * Add a job to the appropriate queue
   */
  static async addJob(
    jobType: JobType,
    data: JobData,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string> {
    let queue: Queue<JobData>;
    
    switch (jobType) {
      case JobType.STORY_GENERATION:
        queue = storyGenerationQueue;
        break;
      case JobType.IMAGE_GENERATION:
        queue = imageGenerationQueue;
        break;
      case JobType.AUDIO_GENERATION:
        queue = audioGenerationQueue;
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const job = await queue.add(jobType, data, options);
    return job.id!;
  }

  /**
   * Get job status
   */
  static async getJobStatus(
    jobType: JobType,
    jobId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: any;
    error?: string;
  }> {
    let queue: Queue<JobData>;
    
    switch (jobType) {
      case JobType.STORY_GENERATION:
        queue = storyGenerationQueue;
        break;
      case JobType.IMAGE_GENERATION:
        queue = imageGenerationQueue;
        break;
      case JobType.AUDIO_GENERATION:
        queue = audioGenerationQueue;
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const job = await queue.getJob(jobId);
    
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = job.progress as number;
    
    let status: 'pending' | 'processing' | 'completed' | 'failed';
    
    switch (state) {
      case 'waiting':
      case 'delayed':
        status = 'pending';
        break;
      case 'active':
        status = 'processing';
        break;
      case 'completed':
        status = 'completed';
        break;
      case 'failed':
        status = 'failed';
        break;
      default:
        status = 'pending';
    }

    return {
      status,
      progress,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  /**
   * Cancel a job
   */
  static async cancelJob(jobType: JobType, jobId: string): Promise<void> {
    let queue: Queue<JobData>;
    
    switch (jobType) {
      case JobType.STORY_GENERATION:
        queue = storyGenerationQueue;
        break;
      case JobType.IMAGE_GENERATION:
        queue = imageGenerationQueue;
        break;
      case JobType.AUDIO_GENERATION:
        queue = audioGenerationQueue;
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const job = await queue.getJob(jobId);
    
    if (job) {
      await job.remove();
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(jobType: JobType) {
    let queue: Queue<JobData>;
    
    switch (jobType) {
      case JobType.STORY_GENERATION:
        queue = storyGenerationQueue;
        break;
      case JobType.IMAGE_GENERATION:
        queue = imageGenerationQueue;
        break;
      case JobType.AUDIO_GENERATION:
        queue = audioGenerationQueue;
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  }

  /**
   * Clean up old jobs
   */
  static async cleanQueue(
    jobType: JobType,
    grace: number = 24 * 3600 * 1000 // 24 hours
  ): Promise<void> {
    let queue: Queue<JobData>;
    
    switch (jobType) {
      case JobType.STORY_GENERATION:
        queue = storyGenerationQueue;
        break;
      case JobType.IMAGE_GENERATION:
        queue = imageGenerationQueue;
        break;
      case JobType.AUDIO_GENERATION:
        queue = audioGenerationQueue;
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace * 7, 100, 'failed'); // Keep failed jobs longer
  }
}

// Export connection for workers
export { connection };
