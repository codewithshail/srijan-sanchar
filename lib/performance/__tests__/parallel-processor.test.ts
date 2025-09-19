/**
 * Tests for Parallel Processor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParallelProcessor, processInParallel } from '../parallel-processor';

describe('ParallelProcessor', () => {
  let processor: ParallelProcessor<string, string>;

  beforeEach(() => {
    processor = new ParallelProcessor<string, string>({
      maxConcurrency: 2,
      retryAttempts: 1,
      retryDelayMs: 100,
      progressiveThreshold: 2,
      timeoutMs: 5000
    });
  });

  describe('Basic Processing', () => {
    it('should process items in parallel', async () => {
      const items = ['item1', 'item2', 'item3', 'item4'];
      const processFn = vi.fn().mockImplementation(async (item: string, index: number) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return `processed-${item}-${index}`;
      });

      const results = await processor.processParallel(items, processFn);

      expect(results).toHaveLength(4);
      expect(results[0].result).toBe('processed-item1-0');
      expect(results[1].result).toBe('processed-item2-1');
      expect(results[2].result).toBe('processed-item3-2');
      expect(results[3].result).toBe('processed-item4-3');
      expect(processFn).toHaveBeenCalledTimes(4);
    });

    it('should maintain order in results', async () => {
      const items = ['a', 'b', 'c'];
      const processFn = vi.fn().mockImplementation(async (item: string, index: number) => {
        // Make later items finish faster to test ordering
        const delay = index === 0 ? 300 : 100;
        await new Promise(resolve => setTimeout(resolve, delay));
        return `${item}-${index}`;
      });

      const results = await processor.processParallel(items, processFn);

      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);
      expect(results[0].result).toBe('a-0');
      expect(results[1].result).toBe('b-1');
      expect(results[2].result).toBe('c-2');
    });
  });

  describe('Error Handling', () => {
    it('should handle processing errors', async () => {
      const items = ['success', 'error', 'success'];
      const processFn = vi.fn().mockImplementation(async (item: string, index: number) => {
        if (item === 'error') {
          throw new Error('Processing failed');
        }
        return `processed-${item}`;
      });

      const results = await processor.processParallel(items, processFn);

      expect(results).toHaveLength(3);
      expect(results[0].result).toBe('processed-success');
      expect(results[1].error).toBeDefined();
      expect(results[1].error!.message).toBe('Processing failed');
      expect(results[2].result).toBe('processed-success');
    });

    it('should retry failed tasks', async () => {
      const items = ['item1'];
      let attemptCount = 0;
      
      const processFn = vi.fn().mockImplementation(async (item: string) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('First attempt failed');
        }
        return `processed-${item}`;
      });

      const results = await processor.processParallel(items, processFn);

      expect(results).toHaveLength(1);
      expect(results[0].result).toBe('processed-item1');
      expect(processFn).toHaveBeenCalledTimes(2); // Original + 1 retry
    });
  });

  describe('Progressive Loading', () => {
    it('should trigger progressive callback when threshold is met', async () => {
      const items = ['item1', 'item2', 'item3', 'item4'];
      const processFn = vi.fn().mockImplementation(async (item: string, index: number) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return `processed-${item}`;
      });

      const progressiveCallback = vi.fn();
      const progressCallback = vi.fn();

      await processor.processParallel(items, processFn, {
        onProgressiveReady: progressiveCallback,
        onProgress: progressCallback
      });

      expect(progressiveCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalled();
    });
  });

  describe('Concurrency Control', () => {
    it('should respect max concurrency limit', async () => {
      const items = ['item1', 'item2', 'item3', 'item4'];
      let activeTasks = 0;
      let maxActiveTasks = 0;

      const processFn = vi.fn().mockImplementation(async (item: string) => {
        activeTasks++;
        maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        activeTasks--;
        return `processed-${item}`;
      });

      await processor.processParallel(items, processFn);

      expect(maxActiveTasks).toBeLessThanOrEqual(2); // Max concurrency is 2
    });
  });

  describe('Statistics', () => {
    it('should provide processing statistics', async () => {
      const items = ['item1', 'item2', 'error'];
      const processFn = vi.fn().mockImplementation(async (item: string) => {
        if (item === 'error') {
          throw new Error('Processing failed');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return `processed-${item}`;
      });

      await processor.processParallel(items, processFn);

      const stats = processor.getStats();
      expect(stats.totalTasks).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('Cancellation', () => {
    it('should cancel active processing', () => {
      const items = ['item1', 'item2', 'item3'];
      const processFn = vi.fn().mockImplementation(async (item: string) => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return `processed-${item}`;
      });

      // Start processing but don't await
      processor.processParallel(items, processFn);

      // Cancel immediately
      processor.cancel();

      const stats = processor.getStats();
      expect(stats.activeTasks).toBe(0);
    });
  });
});

describe('processInParallel utility function', () => {
  it('should process items and return successful results only', async () => {
    const items = ['success1', 'error', 'success2'];
    const processFn = vi.fn().mockImplementation(async (item: string) => {
      if (item === 'error') {
        throw new Error('Processing failed');
      }
      return `processed-${item}`;
    });

    const results = await processInParallel(items, processFn, {
      maxConcurrency: 2,
      retryAttempts: 1
    });

    expect(results).toHaveLength(2);
    expect(results).toContain('processed-success1');
    expect(results).toContain('processed-success2');
  });

  it('should call progress callbacks', async () => {
    const items = ['item1', 'item2'];
    const processFn = vi.fn().mockImplementation(async (item: string) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return `processed-${item}`;
    });

    const progressCallback = vi.fn();
    const progressiveCallback = vi.fn();

    await processInParallel(items, processFn, {
      onProgress: progressCallback,
      onProgressiveReady: progressiveCallback,
      progressiveThreshold: 1
    });

    expect(progressCallback).toHaveBeenCalled();
    expect(progressiveCallback).toHaveBeenCalled();
  });
});