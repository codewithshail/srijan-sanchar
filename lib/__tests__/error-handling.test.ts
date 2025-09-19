import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  StreamingErrorHandler, 
  ErrorRecoveryStrategy, 
  StreamingError 
} from '../error-handling';

describe('StreamingErrorHandler', () => {
  let errorHandler: StreamingErrorHandler;
  let consoleSpy: any;

  beforeEach(() => {
    errorHandler = new StreamingErrorHandler();
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Error Categorization', () => {
    it('should categorize network errors correctly', async () => {
      const networkError = new Error('fetch failed: network connection lost');
      const strategy: ErrorRecoveryStrategy = { type: 'abort', maxAttempts: 0, backoffMs: 0 };
      
      try {
        await errorHandler.handleError(networkError, 'test-context', strategy);
      } catch (error) {
        // Expected to throw due to abort strategy
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.byType.network).toBe(1);
    });

    it('should categorize JSON parsing errors correctly', async () => {
      const parseError = new Error('Unterminated string in JSON at position 1520');
      const strategy: ErrorRecoveryStrategy = { type: 'abort', maxAttempts: 0, backoffMs: 0 };
      
      try {
        await errorHandler.handleError(parseError, 'test-context', strategy);
      } catch (error) {
        // Expected to throw due to abort strategy
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.byType.parsing).toBe(1);
    });

    it('should categorize audio errors correctly', async () => {
      const audioError = new Error('Failed to decode audio buffer');
      const strategy: ErrorRecoveryStrategy = { type: 'abort', maxAttempts: 0, backoffMs: 0 };
      
      try {
        await errorHandler.handleError(audioError, 'test-context', strategy);
      } catch (error) {
        // Expected to throw due to abort strategy
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.byType.audio).toBe(1);
    });

    it('should categorize API errors correctly', async () => {
      const apiError = new Error('API rate limit exceeded');
      const strategy: ErrorRecoveryStrategy = { type: 'abort', maxAttempts: 0, backoffMs: 0 };
      
      try {
        await errorHandler.handleError(apiError, 'test-context', strategy);
      } catch (error) {
        // Expected to throw due to abort strategy
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.byType.api).toBe(1);
    });

    it('should categorize timeout errors correctly', async () => {
      const timeoutError = new Error('Request timeout after 30 seconds');
      const strategy: ErrorRecoveryStrategy = { type: 'abort', maxAttempts: 0, backoffMs: 0 };
      
      try {
        await errorHandler.handleError(timeoutError, 'test-context', strategy);
      } catch (error) {
        // Expected to throw due to abort strategy
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.byType.timeout).toBe(1);
    });
  });

  describe('Retry Strategy', () => {
    it('should retry up to maxAttempts with exponential backoff', async () => {
      const error = new Error('network connection failed');
      const strategy: ErrorRecoveryStrategy = {
        type: 'retry',
        maxAttempts: 3,
        backoffMs: 100
      };

      // First attempt should return true (retry)
      const shouldRetry1 = await errorHandler.handleError(error, 'retry-test', strategy);
      expect(shouldRetry1).toBe(true);

      // Second attempt should return true (retry)
      const shouldRetry2 = await errorHandler.handleError(error, 'retry-test', strategy);
      expect(shouldRetry2).toBe(true);

      // Third attempt should return true (retry)
      const shouldRetry3 = await errorHandler.handleError(error, 'retry-test', strategy);
      expect(shouldRetry3).toBe(true);

      // Fourth attempt should return false (max attempts reached)
      const shouldRetry4 = await errorHandler.handleError(error, 'retry-test', strategy);
      expect(shouldRetry4).toBe(false);
    });

    it('should implement exponential backoff correctly', async () => {
      const error = new Error('network error');
      const strategy: ErrorRecoveryStrategy = {
        type: 'retry',
        maxAttempts: 2,
        backoffMs: 100
      };

      const startTime = Date.now();
      await errorHandler.handleError(error, 'backoff-test', strategy);
      const firstRetryTime = Date.now() - startTime;

      const secondStartTime = Date.now();
      await errorHandler.handleError(error, 'backoff-test', strategy);
      const secondRetryTime = Date.now() - secondStartTime;

      // Second retry should take longer due to exponential backoff
      expect(secondRetryTime).toBeGreaterThan(firstRetryTime);
    });

    it('should execute fallback action when strategy is fallback', async () => {
      const error = new Error('test error');
      const fallbackAction = vi.fn().mockResolvedValue(undefined);
      const strategy: ErrorRecoveryStrategy = {
        type: 'fallback',
        maxAttempts: 0,
        backoffMs: 0,
        fallbackAction
      };

      const result = await errorHandler.handleError(error, 'fallback-test', strategy);
      
      expect(result).toBe(false);
      expect(fallbackAction).toHaveBeenCalledOnce();
    });

    it('should skip operation when strategy is skip', async () => {
      const error = new Error('test error');
      const strategy: ErrorRecoveryStrategy = {
        type: 'skip',
        maxAttempts: 0,
        backoffMs: 0
      };

      const result = await errorHandler.handleError(error, 'skip-test', strategy);
      
      expect(result).toBe(false);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping failed operation: skip-test')
      );
    });

    it('should throw error when strategy is abort', async () => {
      const error = new Error('test error');
      const strategy: ErrorRecoveryStrategy = {
        type: 'abort',
        maxAttempts: 0,
        backoffMs: 0
      };

      await expect(
        errorHandler.handleError(error, 'abort-test', strategy)
      ).rejects.toThrow('test error');
    });
  });

  describe('Error Recovery Options', () => {
    it('should create recovery options with all required callbacks', () => {
      const error: StreamingError = {
        type: 'network',
        message: 'Network error',
        originalError: new Error('test'),
        context: 'test',
        timestamp: new Date(),
        recoverable: true
      };

      const onRetry = vi.fn().mockResolvedValue(undefined);
      const onRegenerate = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();
      const onSkip = vi.fn().mockResolvedValue(undefined);

      const options = errorHandler.createRecoveryOptions(
        error,
        onRetry,
        onRegenerate,
        onCancel,
        onSkip
      );

      expect(options.retry).toBeDefined();
      expect(options.regenerate).toBeDefined();
      expect(options.cancel).toBeDefined();
      expect(options.skip).toBeDefined();
    });

    it('should reset retry attempts when recovery options are used', async () => {
      const error: StreamingError = {
        type: 'network',
        message: 'Network error',
        originalError: new Error('test'),
        context: 'recovery-test',
        timestamp: new Date(),
        recoverable: true
      };

      const onRetry = vi.fn().mockResolvedValue(undefined);
      const onRegenerate = vi.fn().mockResolvedValue(undefined);
      const onCancel = vi.fn();

      // First, create some retry attempts
      const strategy: ErrorRecoveryStrategy = { type: 'retry', maxAttempts: 3, backoffMs: 100 };
      await errorHandler.handleError(new Error('test'), 'recovery-test', strategy);

      const options = errorHandler.createRecoveryOptions(
        error,
        onRetry,
        onRegenerate,
        onCancel
      );

      // Using retry should reset attempts and call onRetry
      await options.retry();
      expect(onRetry).toHaveBeenCalledOnce();

      // Using regenerate should reset attempts and call onRegenerate
      await options.regenerate();
      expect(onRegenerate).toHaveBeenCalledOnce();

      // Using cancel should reset attempts and call onCancel
      options.cancel();
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('Error Messages', () => {
    it('should provide user-friendly messages for network errors', () => {
      const error: StreamingError = {
        type: 'network',
        message: 'Network connection issue',
        originalError: new Error('test'),
        context: 'test',
        timestamp: new Date(),
        recoverable: true
      };

      const message = errorHandler.getErrorMessage(error);
      expect(message).toContain('Network connection issue');
      expect(message).toContain('Check your internet connection');
    });

    it('should provide user-friendly messages for parsing errors', () => {
      const error: StreamingError = {
        type: 'parsing',
        message: 'Data parsing error',
        originalError: new Error('test'),
        context: 'test',
        timestamp: new Date(),
        recoverable: true
      };

      const message = errorHandler.getErrorMessage(error);
      expect(message).toContain('Data parsing error');
      expect(message).toContain('Try regenerating the audio');
    });

    it('should provide user-friendly messages for audio errors', () => {
      const error: StreamingError = {
        type: 'audio',
        message: 'Audio processing error',
        originalError: new Error('test'),
        context: 'test',
        timestamp: new Date(),
        recoverable: true
      };

      const message = errorHandler.getErrorMessage(error);
      expect(message).toContain('Audio processing error');
      expect(message).toContain('Try regenerating the audio');
    });
  });

  describe('Default Strategies', () => {
    it('should provide appropriate default strategy for network errors', () => {
      const strategy = errorHandler.getDefaultStrategy('network');
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.backoffMs).toBe(1000);
    });

    it('should provide appropriate default strategy for API errors', () => {
      const strategy = errorHandler.getDefaultStrategy('api');
      expect(strategy.type).toBe('retry');
      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.backoffMs).toBe(2000);
    });

    it('should provide abort strategy for unknown errors', () => {
      const strategy = errorHandler.getDefaultStrategy('unknown');
      expect(strategy.type).toBe('abort');
      expect(strategy.maxAttempts).toBe(0);
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics correctly', async () => {
      const strategy: ErrorRecoveryStrategy = { type: 'skip', maxAttempts: 0, backoffMs: 0 };

      await errorHandler.handleError(new Error('network error'), 'test1', strategy);
      await errorHandler.handleError(new Error('parse error'), 'test2', strategy);
      await errorHandler.handleError(new Error('audio decode failed'), 'test3', strategy);

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(3);
      expect(stats.byType.network).toBe(1);
      expect(stats.byType.parsing).toBe(1);
      expect(stats.byType.audio).toBe(1);
    });

    it('should limit error history size', async () => {
      const strategy: ErrorRecoveryStrategy = { type: 'skip', maxAttempts: 0, backoffMs: 0 };

      // Add more errors than the max history size (50)
      for (let i = 0; i < 60; i++) {
        await errorHandler.handleError(new Error(`error ${i}`), `test${i}`, strategy);
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBeLessThanOrEqual(50);
    });
  });

  describe('Utility Methods', () => {
    it('should reset retry attempts for specific context', async () => {
      const error = new Error('test error');
      const strategy: ErrorRecoveryStrategy = { type: 'retry', maxAttempts: 3, backoffMs: 100 };

      // Create retry attempts
      await errorHandler.handleError(error, 'context1', strategy);
      await errorHandler.handleError(error, 'context2', strategy);

      // Reset specific context
      errorHandler.reset('context1');

      // context1 should start fresh, context2 should continue
      const shouldRetry1 = await errorHandler.handleError(error, 'context1', strategy);
      const shouldRetry2 = await errorHandler.handleError(error, 'context2', strategy);

      expect(shouldRetry1).toBe(true); // Fresh start
      expect(shouldRetry2).toBe(true); // Second attempt
    });

    it('should reset all retry attempts when no context specified', async () => {
      const error = new Error('test error');
      const strategy: ErrorRecoveryStrategy = { type: 'retry', maxAttempts: 3, backoffMs: 100 };

      // Create retry attempts
      await errorHandler.handleError(error, 'context1', strategy);
      await errorHandler.handleError(error, 'context2', strategy);

      // Reset all contexts
      errorHandler.reset();

      // Both contexts should start fresh
      const shouldRetry1 = await errorHandler.handleError(error, 'context1', strategy);
      const shouldRetry2 = await errorHandler.handleError(error, 'context2', strategy);

      expect(shouldRetry1).toBe(true);
      expect(shouldRetry2).toBe(true);
    });

    it('should clear error history', async () => {
      const strategy: ErrorRecoveryStrategy = { type: 'skip', maxAttempts: 0, backoffMs: 0 };

      await errorHandler.handleError(new Error('test1'), 'test1', strategy);
      await errorHandler.handleError(new Error('test2'), 'test2', strategy);

      let stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(2);

      errorHandler.clearHistory();

      stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(0);
    });

    it('should determine if immediate retry is appropriate', async () => {
      const networkError: StreamingError = {
        type: 'network',
        message: 'Network error',
        originalError: new Error('test'),
        context: 'test',
        timestamp: new Date(),
        recoverable: true
      };

      const apiError: StreamingError = {
        type: 'api',
        message: 'API error',
        originalError: new Error('test'),
        context: 'test',
        timestamp: new Date(),
        recoverable: true
      };

      expect(errorHandler.shouldRetryImmediately(networkError)).toBe(true);
      expect(errorHandler.shouldRetryImmediately(apiError)).toBe(false);
    });
  });
});