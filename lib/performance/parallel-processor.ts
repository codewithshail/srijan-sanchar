/**
 * Parallel Processing Manager for TTS Performance Optimization
 * 
 * Implements parallel processing for multiple text chunks while maintaining
 * playback order and implementing progressive loading to start playback
 * while processing remaining chunks.
 */

export interface ProcessingTask<T, R> {
  id: string;
  index: number;
  data: T;
  priority: number;
  retryCount: number;
  maxRetries: number;
}

export interface ProcessingResult<R> {
  id: string;
  index: number;
  result?: R;
  error?: Error;
  processingTime: number;
}

export interface ProcessorOptions {
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  progressiveThreshold?: number; // Start playback after this many chunks
  timeoutMs?: number;
}

export class ParallelProcessor<T = any, R = any> {
  private readonly maxConcurrency: number;
  private readonly retryAttempts: number;
  private readonly retryDelayMs: number;
  private readonly progressiveThreshold: number;
  private readonly timeoutMs: number;
  
  private activeTasks = new Set<string>();
  private completedResults = new Map<number, any>();
  private failedTasks = new Map<string, any>();
  
  private onProgressCallback?: (completed: number, total: number, results: any[]) => void;
  private onProgressiveReadyCallback?: (readyResults: any[]) => void;
  private onCompleteCallback?: (results: any[]) => void;
  private onErrorCallback?: (error: Error, task: any) => void;

  constructor(options: ProcessorOptions = {}) {
    this.maxConcurrency = options.maxConcurrency || 3;
    this.retryAttempts = options.retryAttempts || 2;
    this.retryDelayMs = options.retryDelayMs || 1000;
    this.progressiveThreshold = options.progressiveThreshold || 1;
    this.timeoutMs = options.timeoutMs || 30000;
    
    console.log('[PARALLEL_PROCESSOR] Initialized with options:', {
      maxConcurrency: this.maxConcurrency,
      retryAttempts: this.retryAttempts,
      progressiveThreshold: this.progressiveThreshold,
      timeoutMs: this.timeoutMs
    });
  }

  /**
   * Process multiple items in parallel with progressive loading
   */
  async processParallel(
    items: T[],
    processFn: (item: T, index: number) => Promise<R>,
    options: {
      onProgress?: (completed: number, total: number, results: any[]) => void;
      onProgressiveReady?: (readyResults: any[]) => void;
      onComplete?: (results: any[]) => void;
      onError?: (error: Error, task: any) => void;
    } = {}
  ): Promise<any[]> {
    
    this.onProgressCallback = options.onProgress as any;
    this.onProgressiveReadyCallback = options.onProgressiveReady as any;
    this.onCompleteCallback = options.onComplete as any;
    this.onErrorCallback = options.onError as any;
    
    // Reset state
    this.activeTasks.clear();
    this.completedResults.clear();
    this.failedTasks.clear();
    
    console.log(`[PARALLEL_PROCESSOR] Starting parallel processing of ${items.length} items`);
    
    // Create processing tasks
    const tasks: ProcessingTask<T, R>[] = items.map((item, index) => ({
      id: `task-${index}-${Date.now()}`,
      index,
      data: item,
      priority: index, // Earlier chunks have higher priority (lower number)
      retryCount: 0,
      maxRetries: this.retryAttempts
    }));
    
    // Sort by priority (index) to ensure ordered processing preference
    tasks.sort((a, b) => a.priority - b.priority);
    
    const startTime = Date.now();
    let progressiveTriggered = false;
    
    // Process tasks with concurrency control
    const processingPromises: Promise<void>[] = [];
    
    for (let i = 0; i < Math.min(this.maxConcurrency, tasks.length); i++) {
      processingPromises.push(this.processTaskQueue(tasks, processFn));
    }
    
    // Monitor progress and trigger progressive loading
    const progressMonitor = setInterval(() => {
      const completedCount = this.completedResults.size;
      const orderedResults = this.getOrderedResults();
      
      // Trigger progress callback
      if (this.onProgressCallback) {
        this.onProgressCallback(completedCount, items.length, orderedResults);
      }
      
      // Trigger progressive loading when threshold is met
      if (!progressiveTriggered && 
          completedCount >= this.progressiveThreshold && 
          this.hasConsecutiveResultsFromStart(this.progressiveThreshold)) {
        
        progressiveTriggered = true;
        const readyResults = orderedResults.slice(0, this.progressiveThreshold);
        
        console.log(`[PARALLEL_PROCESSOR] Progressive threshold reached: ${this.progressiveThreshold} chunks ready`);
        
        if (this.onProgressiveReadyCallback) {
          this.onProgressiveReadyCallback(readyResults);
        }
      }
      
      // Check if all tasks are complete
      if (completedCount === items.length) {
        clearInterval(progressMonitor);
      }
    }, 100);
    
    // Wait for all processing to complete
    await Promise.allSettled(processingPromises);
    clearInterval(progressMonitor);
    
    const processingTime = Date.now() - startTime;
    const orderedResults = this.getOrderedResults();
    const successCount = orderedResults.filter(r => !r.error).length;
    const failureCount = orderedResults.filter(r => r.error).length;
    
    console.log(`[PARALLEL_PROCESSOR] Processing completed:`, {
      totalItems: items.length,
      successCount,
      failureCount,
      processingTimeMs: processingTime,
      averageTimePerItem: processingTime / items.length
    });
    
    // Trigger completion callback
    if (this.onCompleteCallback) {
      this.onCompleteCallback(orderedResults);
    }
    
    return orderedResults;
  }

  /**
   * Process task queue with concurrency control
   */
  private async processTaskQueue<T, R>(
    tasks: ProcessingTask<T, R>[],
    processFn: (item: T, index: number) => Promise<R>
  ): Promise<void> {
    while (tasks.length > 0) {
      // Find next available task (prioritize by index)
      const taskIndex = tasks.findIndex(task => !this.activeTasks.has(task.id));
      if (taskIndex === -1) {
        // No available tasks, wait a bit
        await this.delay(50);
        continue;
      }
      
      const task = tasks.splice(taskIndex, 1)[0];
      this.activeTasks.add(task.id);
      
      try {
        await this.processTask(task, processFn);
      } catch (error) {
        console.error(`[PARALLEL_PROCESSOR] Task ${task.id} failed:`, error);
        
        // Handle retry logic
        if (task.retryCount < task.maxRetries) {
          task.retryCount++;
          console.log(`[PARALLEL_PROCESSOR] Retrying task ${task.id} (attempt ${task.retryCount}/${task.maxRetries})`);
          
          // Add delay before retry
          await this.delay(this.retryDelayMs * Math.pow(2, task.retryCount - 1));
          
          // Re-add task to queue for retry
          tasks.push(task);
        } else {
          // Max retries exceeded, mark as failed
          const result: ProcessingResult<R> = {
            id: task.id,
            index: task.index,
            error: error instanceof Error ? error : new Error(String(error)),
            processingTime: 0
          };
          
          this.completedResults.set(task.index, result);
          this.failedTasks.set(task.id, task);
          
          if (this.onErrorCallback && result.error) {
            this.onErrorCallback(result.error, task);
          }
        }
      } finally {
        this.activeTasks.delete(task.id);
      }
    }
  }

  /**
   * Process individual task with timeout
   */
  private async processTask<T, R>(
    task: ProcessingTask<T, R>,
    processFn: (item: T, index: number) => Promise<R>
  ): Promise<void> {
    const startTime = Date.now();
    
    console.log(`[PARALLEL_PROCESSOR] Processing task ${task.id} (index ${task.index})`);
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task ${task.id} timed out after ${this.timeoutMs}ms`));
        }, this.timeoutMs);
      });
      
      // Race between processing and timeout
      const result = await Promise.race([
        processFn(task.data, task.index),
        timeoutPromise
      ]);
      
      const processingTime = Date.now() - startTime;
      
      const processedResult: ProcessingResult<R> = {
        id: task.id,
        index: task.index,
        result,
        processingTime
      };
      
      this.completedResults.set(task.index, processedResult);
      
      console.log(`[PARALLEL_PROCESSOR] Task ${task.id} completed in ${processingTime}ms`);
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.error(`[PARALLEL_PROCESSOR] Task ${task.id} failed after ${processingTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Check if we have consecutive results from the start
   */
  private hasConsecutiveResultsFromStart(count: number): boolean {
    for (let i = 0; i < count; i++) {
      const result = this.completedResults.get(i);
      if (!result || result.error) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get results ordered by index
   */
  private getOrderedResults(): ProcessingResult<R>[] {
    const results: ProcessingResult<R>[] = [];
    const maxIndex = Math.max(...Array.from(this.completedResults.keys()));
    
    for (let i = 0; i <= maxIndex; i++) {
      const result = this.completedResults.get(i);
      if (result) {
        results.push(result);
      }
    }
    
    return results.sort((a, b) => a.index - b.index);
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const results = this.getOrderedResults();
    const successCount = results.filter(r => !r.error).length;
    const failureCount = results.filter(r => r.error).length;
    const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
    const averageProcessingTime = results.length > 0 ? totalProcessingTime / results.length : 0;
    
    return {
      totalTasks: results.length,
      successCount,
      failureCount,
      activeTasks: this.activeTasks.size,
      totalProcessingTime,
      averageProcessingTime,
      successRate: results.length > 0 ? (successCount / results.length) * 100 : 0
    };
  }

  /**
   * Cancel all active processing
   */
  cancel(): void {
    console.log(`[PARALLEL_PROCESSOR] Cancelling ${this.activeTasks.size} active tasks`);
    
    this.activeTasks.clear();
    this.completedResults.clear();
    this.failedTasks.clear();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Utility function for simple parallel processing
 */
export async function processInParallel<T, R>(
  items: T[],
  processFn: (item: T, index: number) => Promise<R>,
  options: ProcessorOptions & {
    onProgress?: (completed: number, total: number) => void;
    onProgressiveReady?: (readyResults: R[]) => void;
  } = {}
): Promise<R[]> {
  const processor = new ParallelProcessor<T, R>(options);
  
  const results = await processor.processParallel(items, processFn, {
    onProgress: options.onProgress ? 
      (completed, total, results) => options.onProgress!(completed, total) : 
      undefined,
    onProgressiveReady: options.onProgressiveReady ? 
      (results) => options.onProgressiveReady!(results.map(r => r.result!).filter(Boolean)) : 
      undefined
  });
  
  // Return only successful results in order
  return results
    .filter(r => !r.error && r.result !== undefined)
    .map(r => r.result!);
}