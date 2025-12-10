/**
 * Rate Limiting Module
 * 
 * Provides comprehensive rate limiting for all API endpoints:
 * - Redis-backed persistent rate limiting
 * - Per-user and per-IP rate limiting
 * - Different limits for different endpoint categories
 * - User-friendly error messages
 * - Rate limit monitoring and statistics
 * 
 * Requirements: Security (Task 36)
 */

export {
  APIRateLimiter,
  getAPIRateLimiter,
  type RateLimitResult,
  type RateLimitConfig,
  type RateLimitCategory,
} from "./api-rate-limiter";

export {
  withRateLimit,
  createRateLimitMiddleware,
  getRateLimitHeaders,
  checkRateLimit,
  recordRateLimitedRequest,
  rateLimitMiddleware,
  type RateLimitMiddlewareOptions,
} from "./middleware";

export {
  RateLimitMonitor,
  getRateLimitMonitor,
  type RateLimitStats,
  type RateLimitEvent,
} from "./monitor";

export {
  RATE_LIMIT_MESSAGES,
  formatRateLimitError,
  getRateLimitErrorResponse,
  getRateLimitMessage,
  getLocalizedRateLimitMessage,
} from "./messages";
