import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Lazy Redis connection - only created when first used
let connection: Redis | null = null;
let connectionError: Error | null = null;
let isRedisAvailable = false;

/**
 * Get or create Redis connection lazily
 * This prevents connection errors during build/static analysis
 */
function getConnection(): Redis {
  if (connection) {
    return connection;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    connectionError = new Error('REDIS_URL environment variable is not set. Job queue is disabled.');
    throw connectionError;
  }

  try {
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 3) {
          connectionError = new Error('Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000);
      },
    });

    connection.on('connect', () => {
      isRedisAvailable = true;
      connectionError = null;
      console.log('[JOB_QUEUE] Connected to Redis');
    });

    connection.on('error', (err) => {
      isRedisAvailable = false;
      connectionError = err;
      console.error('[JOB_QUEUE] Redis connection error:', err.message);
    });

    connection.on('close', () => {
      isRedisAvailable = false;
      console.log('[JOB_QUEUE] Redis connection closed');
    });

    return connection;
  } catch (err) {
    connectionError = err as Error;
    throw err;
  }
}

/**
 * Check if job queue is available
 */
export function isQueueAvailable(): boolean {
  if (!process.env.REDIS_URL) {
    return false;
  }
  // If connection hasn't been attempted yet, assume it could be available
  if (!connection) {
    return true;
  }
  return isRedisAvailable;
}

/**
 * Get the last connection error if any
 */
export function getQueueError(): Error | null {
  return connectionError;
}

// Job type definitions
export enum JobType {
  STORY_GENERATION = 'story_generation',
  IMAGE_GENERATION = 'image_generation',
  AUDIO_GENERATION = 'audio_generation',
}

export interface JobData {
  storyId: string;
  config?: any;
  /** Database job ID (UUID) - different from BullMQ job ID */
  dbJobId?: string;
  /** Parent job ID for chained jobs */
  parentJobId?: string;
  /** Priority level (lower = higher priority) */
  priority?: number;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Child job IDs spawned by this job */
  childJobIds?: string[];
}

export interface JobProgress {
  progress: number;
  message?: string;
  stage?: string;
}

/**
 * Default retry configuration with exponential backoff
 */
const DEFAULT_RETRY_CONFIG = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // Start with 2 seconds
  },
};

/**
 * Job-specific retry configurations
 */
const JOB_RETRY_CONFIGS: Record<JobType, typeof DEFAULT_RETRY_CONFIG> = {
  [JobType.STORY_GENERATION]: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000, // 3s, 6s, 12s
    },
  },
  [JobType.IMAGE_GENERATION]: {
    attempts: 4, // More retries for image generation (API can be flaky)
    backoff: {
      type: 'exponential',
      delay: 5000, // 5s, 10s, 20s, 40s
    },
  },
  [JobType.AUDIO_GENERATION]: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
  },
};

// Lazily created queues
let storyGenerationQueue: Queue<JobData> | null = null;
let imageGenerationQueue: Queue<JobData> | null = null;
let audioGenerationQueue: Queue<JobData> | null = null;

function getStoryGenerationQueue(): Queue<JobData> {
  if (!storyGenerationQueue) {
    storyGenerationQueue = new Queue<JobData>('story-generation', {
      connection: getConnection(),
      defaultJobOptions: {
        ...JOB_RETRY_CONFIGS[JobType.STORY_GENERATION],
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
  }
  return storyGenerationQueue;
}

function getImageGenerationQueue(): Queue<JobData> {
  if (!imageGenerationQueue) {
    imageGenerationQueue = new Queue<JobData>('image-generation', {
      connection: getConnection(),
      defaultJobOptions: {
        ...JOB_RETRY_CONFIGS[JobType.IMAGE_GENERATION],
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
  }
  return imageGenerationQueue;
}

function getAudioGenerationQueue(): Queue<JobData> {
  if (!audioGenerationQueue) {
    audioGenerationQueue = new Queue<JobData>('audio-generation', {
      connection: getConnection(),
      defaultJobOptions: {
        ...JOB_RETRY_CONFIGS[JobType.AUDIO_GENERATION],
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
  }
  return audioGenerationQueue;
}


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
        queue = getStoryGenerationQueue();
        break;
      case JobType.IMAGE_GENERATION:
        queue = getImageGenerationQueue();
        break;
      case JobType.AUDIO_GENERATION:
        queue = getAudioGenerationQueue();
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
        queue = getStoryGenerationQueue();
        break;
      case JobType.IMAGE_GENERATION:
        queue = getImageGenerationQueue();
        break;
      case JobType.AUDIO_GENERATION:
        queue = getAudioGenerationQueue();
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
        queue = getStoryGenerationQueue();
        break;
      case JobType.IMAGE_GENERATION:
        queue = getImageGenerationQueue();
        break;
      case JobType.AUDIO_GENERATION:
        queue = getAudioGenerationQueue();
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
        queue = getStoryGenerationQueue();
        break;
      case JobType.IMAGE_GENERATION:
        queue = getImageGenerationQueue();
        break;
      case JobType.AUDIO_GENERATION:
        queue = getAudioGenerationQueue();
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
        queue = getStoryGenerationQueue();
        break;
      case JobType.IMAGE_GENERATION:
        queue = getImageGenerationQueue();
        break;
      case JobType.AUDIO_GENERATION:
        queue = getAudioGenerationQueue();
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }

    await queue.clean(grace, 100, 'completed');
    await queue.clean(grace * 7, 100, 'failed'); // Keep failed jobs longer
  }

  /**
   * Get detailed job information including retry attempts
   */
  static async getJobDetails(
    jobType: JobType,
    jobId: string
  ): Promise<{
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    attemptsMade: number;
    maxAttempts: number;
    data: JobData;
    result?: any;
    error?: string;
    failedReason?: string;
    processedOn?: Date;
    finishedOn?: Date;
    timestamp: Date;
  } | null> {
    const queue = this.getQueue(jobType);
    const job = await queue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
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
      id: job.id!,
      status,
      progress: job.progress as number || 0,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts || 3,
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason,
      failedReason: job.failedReason,
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
      timestamp: new Date(job.timestamp),
    };
  }

  /**
   * Get queue instance by job type
   */
  private static getQueue(jobType: JobType): Queue<JobData> {
    switch (jobType) {
      case JobType.STORY_GENERATION:
        return getStoryGenerationQueue();
      case JobType.IMAGE_GENERATION:
        return getImageGenerationQueue();
      case JobType.AUDIO_GENERATION:
        return getAudioGenerationQueue();
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
  }

  /**
   * Retry a failed job
   */
  static async retryJob(jobType: JobType, jobId: string): Promise<boolean> {
    const queue = this.getQueue(jobType);
    const job = await queue.getJob(jobId);

    if (!job) {
      return false;
    }

    const state = await job.getState();
    if (state !== 'failed') {
      return false;
    }

    await job.retry();
    return true;
  }

  /**
   * Get all jobs for a specific story
   */
  static async getJobsForStory(
    storyId: string
  ): Promise<Array<{
    jobType: JobType;
    jobId: string;
    status: string;
    progress: number;
    createdAt: Date;
  }>> {
    const results: Array<{
      jobType: JobType;
      jobId: string;
      status: string;
      progress: number;
      createdAt: Date;
    }> = [];

    for (const jobType of Object.values(JobType)) {
      const queue = this.getQueue(jobType);

      // Get all jobs (this is expensive, use sparingly)
      const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);

      for (const job of jobs) {
        if (job.data.storyId === storyId) {
          const state = await job.getState();
          results.push({
            jobType,
            jobId: job.id!,
            status: state,
            progress: job.progress as number || 0,
            createdAt: new Date(job.timestamp),
          });
        }
      }
    }

    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Add a chained job (job that depends on another job)
   */
  static async addChainedJob(
    jobType: JobType,
    data: JobData,
    parentJobId: string,
    options?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string> {
    return this.addJob(jobType, {
      ...data,
      parentJobId,
    }, options);
  }

  /**
   * Get retry configuration for a job type
   */
  static getRetryConfig(jobType: JobType): typeof DEFAULT_RETRY_CONFIG {
    return JOB_RETRY_CONFIGS[jobType] || DEFAULT_RETRY_CONFIG;
  }
}

// Export getConnection for workers (connection is lazily created)
export { getConnection };
