/**
 * Rate Limiting Middleware
 * 
 * Provides middleware utilities for applying rate limiting to API routes:
 * - Higher-order function for wrapping route handlers
 * - Automatic header generation
 * - IP and user-based identification
 * 
 * Requirements: Security (Task 36)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { 
  getAPIRateLimiter, 
  type RateLimitCategory, 
  type RateLimitResult 
} from "./api-rate-limiter";
import { getRateLimitErrorResponse } from "./messages";
import { getRateLimitMonitor } from "./monitor";

/**
 * Options for rate limit middleware
 */
export interface RateLimitMiddlewareOptions {
  category?: RateLimitCategory;
  identifierType?: "ip" | "user" | "both";
  skipOnError?: boolean;
  onRateLimited?: (result: RateLimitResult, req: NextRequest) => void;
}

/**
 * Extract client IP from request
 */
function getClientIP(req: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback to a default identifier
  return "unknown";
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
    "X-RateLimit-Category": result.category,
  };

  if (result.retryAfter !== undefined) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Apply rate limit headers to a response
 */
function applyRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = getRateLimitHeaders(result);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 */
export function withRateLimit<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
  options: RateLimitMiddlewareOptions = {}
): (req: NextRequest, ...args: T) => Promise<NextResponse> {
  const {
    category = "general",
    identifierType = "both",
    skipOnError = true,
    onRateLimited,
  } = options;

  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const rateLimiter = getAPIRateLimiter();
    const monitor = getRateLimitMonitor();

    try {
      // Get identifier(s)
      const identifiers: string[] = [];

      if (identifierType === "ip" || identifierType === "both") {
        const ip = getClientIP(req);
        identifiers.push(`ip:${ip}`);
      }

      if (identifierType === "user" || identifierType === "both") {
        try {
          const { userId } = await auth();
          if (userId) {
            identifiers.push(`user:${userId}`);
          }
        } catch {
          // Auth not available, continue with IP only
        }
      }

      // Check rate limit for all identifiers
      let mostRestrictiveResult: RateLimitResult | null = null;

      for (const identifier of identifiers) {
        const result = await rateLimiter.checkLimit(identifier, category);

        if (!result.allowed) {
          // Record the rate limit event
          monitor.recordEvent({
            identifier,
            category,
            allowed: false,
            remaining: result.remaining,
            timestamp: Date.now(),
            path: req.nextUrl.pathname,
            method: req.method,
          });

          // Call custom handler if provided
          if (onRateLimited) {
            onRateLimited(result, req);
          }

          // Return rate limit error response
          const errorResponse = getRateLimitErrorResponse(result);
          return applyRateLimitHeaders(errorResponse, result);
        }

        // Track the most restrictive result
        if (!mostRestrictiveResult || result.remaining < mostRestrictiveResult.remaining) {
          mostRestrictiveResult = result;
        }
      }

      // Record successful requests
      for (const identifier of identifiers) {
        await rateLimiter.recordRequest(identifier, category);
        
        monitor.recordEvent({
          identifier,
          category,
          allowed: true,
          remaining: mostRestrictiveResult?.remaining ?? 0,
          timestamp: Date.now(),
          path: req.nextUrl.pathname,
          method: req.method,
        });
      }

      // Execute the handler
      const response = await handler(req, ...args);

      // Apply rate limit headers to successful response
      if (mostRestrictiveResult) {
        return applyRateLimitHeaders(response, mostRestrictiveResult);
      }

      return response;
    } catch (error) {
      console.error("[RATE_LIMIT_MIDDLEWARE] Error:", error);

      if (skipOnError) {
        // Continue without rate limiting on error
        return handler(req, ...args);
      }

      throw error;
    }
  };
}

/**
 * Create a reusable rate limit middleware for a specific category
 */
export function createRateLimitMiddleware(
  category: RateLimitCategory,
  options: Omit<RateLimitMiddlewareOptions, "category"> = {}
) {
  return <T extends unknown[]>(
    handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
  ) => withRateLimit(handler, { ...options, category });
}

/**
 * Pre-configured middleware for common categories
 */
export const rateLimitMiddleware = {
  general: createRateLimitMiddleware("general"),
  ai: createRateLimitMiddleware("ai"),
  aiHeavy: createRateLimitMiddleware("ai_heavy"),
  tts: createRateLimitMiddleware("tts"),
  stt: createRateLimitMiddleware("stt"),
  comments: createRateLimitMiddleware("comments"),
  stories: createRateLimitMiddleware("stories"),
  uploads: createRateLimitMiddleware("uploads"),
  admin: createRateLimitMiddleware("admin", { identifierType: "user" }),
  payment: createRateLimitMiddleware("payment", { identifierType: "user" }),
  auth: createRateLimitMiddleware("auth", { identifierType: "ip" }),
};

/**
 * Utility to check rate limit without wrapping a handler
 * Useful for manual rate limit checks in complex handlers
 */
export async function checkRateLimit(
  req: NextRequest,
  category: RateLimitCategory = "general",
  identifierType: "ip" | "user" | "both" = "both"
): Promise<{ allowed: boolean; result: RateLimitResult | null }> {
  const rateLimiter = getAPIRateLimiter();
  const identifiers: string[] = [];

  if (identifierType === "ip" || identifierType === "both") {
    const ip = getClientIP(req);
    identifiers.push(`ip:${ip}`);
  }

  if (identifierType === "user" || identifierType === "both") {
    try {
      const { userId } = await auth();
      if (userId) {
        identifiers.push(`user:${userId}`);
      }
    } catch {
      // Auth not available
    }
  }

  for (const identifier of identifiers) {
    const result = await rateLimiter.checkLimit(identifier, category);
    if (!result.allowed) {
      return { allowed: false, result };
    }
  }

  return { allowed: true, result: null };
}

/**
 * Record a request after manual rate limit check
 */
export async function recordRateLimitedRequest(
  req: NextRequest,
  category: RateLimitCategory = "general",
  identifierType: "ip" | "user" | "both" = "both"
): Promise<void> {
  const rateLimiter = getAPIRateLimiter();
  const identifiers: string[] = [];

  if (identifierType === "ip" || identifierType === "both") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
               req.headers.get("x-real-ip") ||
               "unknown";
    identifiers.push(`ip:${ip}`);
  }

  if (identifierType === "user" || identifierType === "both") {
    try {
      const { userId } = await auth();
      if (userId) {
        identifiers.push(`user:${userId}`);
      }
    } catch {
      // Auth not available
    }
  }

  for (const identifier of identifiers) {
    await rateLimiter.recordRequest(identifier, category);
  }
}
