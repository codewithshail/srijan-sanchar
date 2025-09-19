/**
 * Comprehensive error handling for audio streaming functionality
 * Provides configurable retry strategies, specific error messages, and recovery options
 */

export interface ErrorRecoveryStrategy {
  type: "retry" | "skip" | "fallback" | "abort";
  maxAttempts: number;
  backoffMs: number;
  fallbackAction?: () => Promise<void>;
}

export interface StreamingError {
  type: "network" | "parsing" | "audio" | "api" | "timeout" | "unknown";
  message: string;
  originalError: Error;
  context: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface ErrorRecoveryOptions {
  retry: () => Promise<void>;
  regenerate: () => Promise<void>;
  cancel: () => void;
  skip?: () => Promise<void>;
}

export class StreamingErrorHandler {
  private retryAttempts: Map<string, number> = new Map();
  private errorHistory: StreamingError[] = [];
  private maxHistorySize = 50;

  /**
   * Handle an error with the specified recovery strategy
   */
  async handleError(
    error: Error,
    context: string,
    strategy: ErrorRecoveryStrategy
  ): Promise<boolean> {
    const streamingError = this.categorizeError(error, context);
    this.addToHistory(streamingError);

    const attempts = this.retryAttempts.get(context) || 0;

    console.error(
      `[ERROR_HANDLER] ${streamingError.type} error in ${context}:`,
      {
        message: streamingError.message,
        attempts: attempts + 1,
        maxAttempts: strategy.maxAttempts,
        strategy: strategy.type,
      }
    );

    switch (strategy.type) {
      case "retry":
        if (attempts < strategy.maxAttempts && streamingError.recoverable) {
          this.retryAttempts.set(context, attempts + 1);
          const delay = this.calculateBackoff(strategy.backoffMs, attempts);
          await this.delay(delay);
          return true; // Retry
        }
        break;

      case "skip":
        console.warn(`[ERROR_HANDLER] Skipping failed operation: ${context}`);
        return false; // Don't retry, continue with next

      case "fallback":
        if (strategy.fallbackAction) {
          try {
            await strategy.fallbackAction();
            console.info(
              `[ERROR_HANDLER] Fallback action completed for: ${context}`
            );
          } catch (fallbackError) {
            console.error(
              `[ERROR_HANDLER] Fallback action failed:`,
              fallbackError
            );
          }
        }
        return false;

      case "abort":
        throw streamingError.originalError;
    }

    return false;
  }

  /**
   * Categorize error by type and determine if it's recoverable
   */
  private categorizeError(error: Error, context: string): StreamingError {
    const message = error.message.toLowerCase();
    let type: StreamingError["type"] = "unknown";
    let recoverable = true;
    let userMessage = error.message;

    // Timeout errors (check first to avoid conflict with network timeout)
    if (message.includes("timeout") || message.includes("aborted")) {
      type = "timeout";
      userMessage =
        "Request timed out. Please try again with a shorter text or check your connection.";
    }
    // Network errors
    else if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("connection")
    ) {
      type = "network";
      userMessage =
        "Network connection issue. Please check your internet connection and try again.";
    }
    // JSON parsing errors
    else if (
      message.includes("json") ||
      message.includes("parse") ||
      message.includes("unterminated") ||
      message.includes("unexpected token")
    ) {
      type = "parsing";
      userMessage =
        "Data parsing error. The audio stream may be corrupted. Try regenerating the audio.";
    }
    // Audio-related errors
    else if (
      message.includes("audio") ||
      message.includes("decode") ||
      message.includes("wav") ||
      message.includes("buffer")
    ) {
      type = "audio";
      userMessage =
        "Audio processing error. The audio data may be invalid. Try regenerating the audio.";
    }
    // API errors
    else if (
      message.includes("api") ||
      message.includes("rate limit") ||
      message.includes("quota") ||
      message.includes("unauthorized")
    ) {
      type = "api";
      if (message.includes("rate limit") || message.includes("quota")) {
        userMessage =
          "API rate limit exceeded. Please wait a moment and try again.";
      } else if (message.includes("unauthorized")) {
        userMessage =
          "API authentication failed. Please check your configuration.";
        recoverable = false;
      } else {
        userMessage = "API service error. Please try again in a moment.";
      }
    }

    return {
      type,
      message: userMessage,
      originalError: error,
      context,
      timestamp: new Date(),
      recoverable,
    };
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(baseMs: number, attempt: number): number {
    const exponentialDelay = baseMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Create user-friendly error recovery options
   */
  createRecoveryOptions(
    error: StreamingError,
    onRetry: () => Promise<void>,
    onRegenerate: () => Promise<void>,
    onCancel: () => void,
    onSkip?: () => Promise<void>
  ): ErrorRecoveryOptions {
    return {
      retry: async () => {
        console.info(
          `[ERROR_HANDLER] User initiated retry for: ${error.context}`
        );
        this.reset(error.context);
        await onRetry();
      },
      regenerate: async () => {
        console.info(
          `[ERROR_HANDLER] User initiated regenerate for: ${error.context}`
        );
        this.reset(error.context);
        await onRegenerate();
      },
      cancel: () => {
        console.info(
          `[ERROR_HANDLER] User cancelled operation: ${error.context}`
        );
        this.reset(error.context);
        onCancel();
      },
      skip: onSkip
        ? async () => {
            console.info(
              `[ERROR_HANDLER] User skipped operation: ${error.context}`
            );
            await onSkip();
          }
        : undefined,
    };
  }

  /**
   * Get user-friendly error message with recovery suggestions
   */
  getErrorMessage(error: StreamingError): string {
    const baseMessage = error.message;

    switch (error.type) {
      case "network":
        return `${baseMessage}\n\nSuggestions:\n• Check your internet connection\n• Try again in a moment\n• Use a shorter text if the problem persists`;

      case "parsing":
        return `${baseMessage}\n\nSuggestions:\n• Try regenerating the audio\n• Break your text into smaller sections\n• Contact support if this continues`;

      case "audio":
        return `${baseMessage}\n\nSuggestions:\n• Try regenerating the audio\n• Check if your browser supports audio playback\n• Try a different browser if issues persist`;

      case "api":
        return `${baseMessage}\n\nSuggestions:\n• Wait a moment and try again\n• Try with shorter text\n• Check service status if problems continue`;

      case "timeout":
        return `${baseMessage}\n\nSuggestions:\n• Try with shorter text\n• Check your internet connection\n• Wait a moment and try again`;

      default:
        return `${baseMessage}\n\nSuggestions:\n• Try again\n• Refresh the page if problems persist\n• Contact support if this continues`;
    }
  }

  /**
   * Check if an error type should trigger immediate retry
   */
  shouldRetryImmediately(error: StreamingError): boolean {
    return error.type === "network" && error.recoverable;
  }

  /**
   * Get default retry strategy based on error type
   */
  getDefaultStrategy(errorType: StreamingError["type"]): ErrorRecoveryStrategy {
    switch (errorType) {
      case "network":
        return {
          type: "retry",
          maxAttempts: 3,
          backoffMs: 1000,
        };

      case "parsing":
        return {
          type: "retry",
          maxAttempts: 2,
          backoffMs: 500,
        };

      case "audio":
        return {
          type: "retry",
          maxAttempts: 2,
          backoffMs: 1000,
        };

      case "api":
        return {
          type: "retry",
          maxAttempts: 3,
          backoffMs: 2000,
        };

      case "timeout":
        return {
          type: "retry",
          maxAttempts: 2,
          backoffMs: 3000,
        };

      default:
        return {
          type: "abort",
          maxAttempts: 0,
          backoffMs: 0,
        };
    }
  }

  /**
   * Add error to history for debugging and analytics
   */
  private addToHistory(error: StreamingError): void {
    this.errorHistory.push(error);

    // Keep history size manageable
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get error statistics for debugging
   */
  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    recent: StreamingError[];
  } {
    const byType: Record<string, number> = {};

    for (const error of this.errorHistory) {
      byType[error.type] = (byType[error.type] || 0) + 1;
    }

    const recent = this.errorHistory
      .filter((e) => Date.now() - e.timestamp.getTime() < 300000) // Last 5 minutes
      .slice(-10); // Last 10 errors

    return {
      total: this.errorHistory.length,
      byType,
      recent,
    };
  }

  /**
   * Reset retry attempts for a specific context or all contexts
   */
  reset(context?: string): void {
    if (context) {
      this.retryAttempts.delete(context);
    } else {
      this.retryAttempts.clear();
    }
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Utility method for delays with exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if we should show detailed error information (for debugging)
   */
  shouldShowDetailedError(): boolean {
    return (
      process.env.NODE_ENV === "development" ||
      (typeof window !== "undefined" &&
        window.location.search.includes("debug=true"))
    );
  }
}

// Export singleton instance for consistent error handling across the app
export const streamingErrorHandler = new StreamingErrorHandler();

// Error types are already exported as interfaces above

// Additional exports for compatibility with existing hooks
export interface ErrorHandlingOptions {
  showToast?: boolean;
  logError?: boolean;
  context?: string;
}

export function handleApiError(error: unknown, options: ErrorHandlingOptions = {}): Error {
  const { showToast = true, logError = true, context = 'API' } = options;
  
  let appError: Error;
  
  if (error instanceof Error) {
    appError = error;
  } else if (typeof error === 'string') {
    appError = new Error(error);
  } else {
    appError = new Error('An unknown error occurred');
  }
  
  if (logError) {
    console.error(`[${context}_ERROR]`, appError);
  }
  
  // Note: Toast notifications would need to be implemented separately
  // as this is a utility function that shouldn't depend on UI components
  
  return appError;
}
