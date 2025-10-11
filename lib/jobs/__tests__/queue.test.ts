import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { JobQueue, JobType } from '../queue';

describe('JobQueue', () => {
  test('should add a story generation job', async () => {
    const jobId = await JobQueue.addJob(JobType.STORY_GENERATION, {
      storyId: 'test-story-id',
      config: {
        numberOfPages: 8,
        tone: 'narrative',
      },
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  test('should get job status', async () => {
    const jobId = await JobQueue.addJob(JobType.IMAGE_GENERATION, {
      storyId: 'test-story-id',
      config: {
        numberOfImages: 3,
      },
    });

    const status = await JobQueue.getJobStatus(JobType.IMAGE_GENERATION, jobId);

    expect(status).toBeDefined();
    expect(status.status).toBe('pending');
  });

  test('should get queue stats', async () => {
    const stats = await JobQueue.getQueueStats(JobType.STORY_GENERATION);

    expect(stats).toBeDefined();
    expect(typeof stats.waiting).toBe('number');
    expect(typeof stats.active).toBe('number');
    expect(typeof stats.completed).toBe('number');
    expect(typeof stats.failed).toBe('number');
  });

  test('should throw error for unknown job type', async () => {
    await expect(
      JobQueue.addJob('unknown_type' as JobType, {
        storyId: 'test',
      })
    ).rejects.toThrow('Unknown job type');
  });
});
