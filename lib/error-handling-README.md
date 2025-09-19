# Comprehensive Error Handling for Audio Streaming

This module provides robust error handling capabilities for the audio streaming functionality, addressing the requirements for comprehensive error recovery, user-friendly messages, and configurable retry strategies.

## Features

### 🔄 Configurable Retry Strategies
- **Retry**: Automatic retry with exponential backoff
- **Skip**: Skip failed operations and continue
- **Fallback**: Execute alternative actions when primary fails
- **Abort**: Stop execution and throw error

### 🎯 Intelligent Error Categorization
- **Network Errors**: Connection issues, timeouts, fetch failures
- **Parsing Errors**: JSON parsing, malformed data, stream corruption
- **Audio Errors**: Audio decoding, WAV processing, buffer issues
- **API Errors**: Rate limits, authentication, service errors
- **Timeout Errors**: Request timeouts, operation timeouts

### 💬 User-Friendly Error Messages
- Clear, actionable error descriptions
- Specific suggestions for each error type
- Recovery options and next steps
- Technical details hidden in development mode

### 📊 Error Analytics and Monitoring
- Error history tracking
- Statistics by error type
- Recent error analysis
- Performance recommendations

## Usage

### Basic Error Handling

```typescript
import { streamingErrorHandler, ErrorRecoveryStrategy } from './error-handling';

// Define retry strategy
const strategy: ErrorRecoveryStrategy = {
  type: 'retry',
  maxAttempts: 3,
  backoffMs: 1000
};

// Handle errors with automatic retry
try {
  await someOperation();
} catch (error) {
  const shouldRetry = await streamingErrorHandler.handleError(
    error,
    'operation-context',
    strategy
  );
  
  if (shouldRetry) {
    // Retry the operation
    await someOperation();
  }
}
```

### Error Recovery Options

```typescript
// Create user-friendly recovery options
const error = /* StreamingError from handler */;
const recoveryOptions = streamingErrorHandler.createRecoveryOptions(
  error,
  async () => { /* retry logic */ },
  async () => { /* regenerate logic */ },
  () => { /* cancel logic */ },
  async () => { /* skip logic (optional) */ }
);

// Use in UI
<ErrorDialog 
  error={error}
  message={streamingErrorHandler.getErrorMessage(error)}
  onRetry={recoveryOptions.retry}
  onRegenerate={recoveryOptions.regenerate}
  onCancel={recoveryOptions.cancel}
/>
```

### Default Strategies by Error Type

```typescript
// Get recommended strategy for error type
const strategy = streamingErrorHandler.getDefaultStrategy('network');
// Returns: { type: 'retry', maxAttempts: 3, backoffMs: 1000 }

const apiStrategy = streamingErrorHandler.getDefaultStrategy('api');
// Returns: { type: 'retry', maxAttempts: 3, backoffMs: 2000 }
```

### Error Analytics

```typescript
// Get error statistics
const stats = streamingErrorHandler.getErrorStats();
console.log('Total errors:', stats.total);
console.log('Errors by type:', stats.byType);
console.log('Recent errors:', stats.recent);

// Monitor error patterns
const monitoring = new ErrorMonitoringService();
const analytics = monitoring.getErrorAnalytics();
console.log('Error rate:', analytics.errorRate, 'errors/minute');
console.log('Recommendations:', analytics.recommendations);
```

## Error Types and Messages

### Network Errors
- **Triggers**: `fetch`, `network`, `connection`
- **Message**: "Network connection issue. Please check your internet connection and try again."
- **Suggestions**: Check connection, retry, use shorter text
- **Default Strategy**: Retry 3 times with 1s backoff

### Parsing Errors
- **Triggers**: `json`, `parse`, `unterminated`, `unexpected token`
- **Message**: "Data parsing error. The audio stream may be corrupted. Try regenerating the audio."
- **Suggestions**: Regenerate audio, break into smaller sections
- **Default Strategy**: Retry 2 times with 500ms backoff

### Audio Errors
- **Triggers**: `audio`, `decode`, `wav`, `buffer`
- **Message**: "Audio processing error. The audio data may be invalid. Try regenerating the audio."
- **Suggestions**: Regenerate audio, check browser support
- **Default Strategy**: Retry 2 times with 1s backoff

### API Errors
- **Triggers**: `api`, `rate limit`, `quota`, `unauthorized`
- **Message**: Context-specific (rate limit, auth, service error)
- **Suggestions**: Wait and retry, check configuration
- **Default Strategy**: Retry 3 times with 2s backoff

### Timeout Errors
- **Triggers**: `timeout`, `aborted`
- **Message**: "Request timed out. Please try again with a shorter text or check your connection."
- **Suggestions**: Use shorter text, check connection
- **Default Strategy**: Retry 2 times with 3s backoff

## Integration Examples

### React Hook Integration

```typescript
function useStreamingTTSWithErrorHandling() {
  const [error, setError] = useState<StreamingError | null>(null);
  const [recoveryOptions, setRecoveryOptions] = useState<ErrorRecoveryOptions | null>(null);

  const streamAudio = async (text: string) => {
    try {
      const result = await ttsService.streamTTS(text);
      if (!result.success) {
        setError(result.error);
        setRecoveryOptions(result.recoveryOptions);
      }
      return result;
    } catch (error) {
      // Handle unexpected errors
    }
  };

  return { streamAudio, error, recoveryOptions };
}
```

### Service Integration

```typescript
class TTSStreamingService {
  async streamTTS(text: string) {
    const context = 'tts-streaming';
    
    try {
      const response = await this.makeAPIRequest(text, context);
      return await this.processStream(response, context);
    } catch (error) {
      const streamingError = await this.handleError(error, context);
      return {
        success: false,
        error: streamingError,
        recoveryOptions: this.createRecoveryOptions(streamingError, text)
      };
    }
  }
}
```

## Configuration

### Environment Variables
- `NODE_ENV=development`: Shows detailed error information
- URL parameter `?debug=true`: Enables debug mode in browser

### Customization

```typescript
// Custom retry strategy
const customStrategy: ErrorRecoveryStrategy = {
  type: 'retry',
  maxAttempts: 5,
  backoffMs: 2000,
  fallbackAction: async () => {
    // Custom fallback logic
    await switchToBackupService();
  }
};

// Custom error categorization
class CustomErrorHandler extends StreamingErrorHandler {
  protected categorizeError(error: Error, context: string): StreamingError {
    // Add custom error categorization logic
    if (error.message.includes('custom-error')) {
      return {
        type: 'custom',
        message: 'Custom error occurred',
        originalError: error,
        context,
        timestamp: new Date(),
        recoverable: true
      };
    }
    
    return super.categorizeError(error, context);
  }
}
```

## Best Practices

### 1. Context Naming
Use descriptive context names for better debugging:
```typescript
// Good
await errorHandler.handleError(error, 'tts-streaming-chunk-processing', strategy);

// Bad
await errorHandler.handleError(error, 'error', strategy);
```

### 2. Strategy Selection
Choose appropriate strategies based on error criticality:
```typescript
// Critical operations - abort on failure
const criticalStrategy = { type: 'abort', maxAttempts: 0, backoffMs: 0 };

// Non-critical operations - skip on failure
const nonCriticalStrategy = { type: 'skip', maxAttempts: 0, backoffMs: 0 };

// Recoverable operations - retry with backoff
const recoverableStrategy = { type: 'retry', maxAttempts: 3, backoffMs: 1000 };
```

### 3. Error Monitoring
Regularly monitor error patterns:
```typescript
// Log error statistics periodically
setInterval(() => {
  const stats = streamingErrorHandler.getErrorStats();
  if (stats.total > 0) {
    console.log('[ERROR_MONITORING]', stats);
  }
}, 60000); // Every minute
```

### 4. User Experience
Provide clear recovery options:
```typescript
// Always provide retry and cancel options
const recoveryOptions = errorHandler.createRecoveryOptions(
  error,
  () => retryOperation(),
  () => regenerateContent(),
  () => cancelOperation()
);

// Show user-friendly messages
const userMessage = errorHandler.getErrorMessage(error);
showErrorDialog(userMessage, recoveryOptions);
```

## Testing

The error handling system includes comprehensive unit tests covering:

- Error categorization accuracy
- Retry strategy execution
- Exponential backoff timing
- Recovery option functionality
- Error message generation
- Statistics tracking
- Memory management

Run tests with:
```bash
npx vitest run lib/__tests__/error-handling.test.ts
```

## Performance Considerations

### Memory Management
- Error history is limited to 50 entries
- Automatic cleanup of old retry attempts
- Efficient error categorization with early returns

### Network Optimization
- Exponential backoff prevents API flooding
- Jitter in retry timing reduces thundering herd
- Maximum backoff cap prevents excessive delays

### User Experience
- Immediate retry for network errors when appropriate
- Progressive error disclosure (simple → detailed)
- Non-blocking error handling for non-critical operations

## Requirements Satisfied

This implementation satisfies all requirements from the specification:

- **5.1**: ✅ Specific error messages for different failure scenarios
- **5.2**: ✅ User-friendly error recovery options (retry, regenerate, cancel)
- **5.3**: ✅ Exponential backoff for failed API requests
- **5.4**: ✅ Configurable retry strategies with proper error handling
- **5.5**: ✅ Comprehensive logging and error tracking for debugging