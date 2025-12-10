/**
 * Admin Rate Limits API
 * 
 * Provides endpoints for monitoring and managing rate limits:
 * - GET: Get rate limit statistics
 * - POST: Reset rate limits for specific identifiers
 * 
 * Requirements: Security (Task 36)
 */

import { NextRequest, NextResponse } from "next/server";
import { isUserAdmin } from "@/lib/auth";
import { getRateLimitMonitor } from "@/lib/rate-limiting/monitor";
import { getAPIRateLimiter, type RateLimitCategory } from "@/lib/rate-limiting/api-rate-limiter";

/**
 * GET - Get rate limit statistics
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get("timeRange") || "1h";
    const view = searchParams.get("view") || "summary";

    // Parse time range
    let timeRangeMs: number;
    switch (timeRange) {
      case "5m":
        timeRangeMs = 5 * 60 * 1000;
        break;
      case "15m":
        timeRangeMs = 15 * 60 * 1000;
        break;
      case "1h":
        timeRangeMs = 60 * 60 * 1000;
        break;
      case "6h":
        timeRangeMs = 6 * 60 * 60 * 1000;
        break;
      case "24h":
        timeRangeMs = 24 * 60 * 60 * 1000;
        break;
      default:
        timeRangeMs = 60 * 60 * 1000;
    }

    const monitor = getRateLimitMonitor();

    if (view === "realtime") {
      const realTimeStats = monitor.getRealTimeStats();
      return NextResponse.json({
        type: "realtime",
        data: realTimeStats,
        timestamp: Date.now(),
      });
    }

    const stats = monitor.getStats(timeRangeMs);

    return NextResponse.json({
      type: "summary",
      data: stats,
      timeRange,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[ADMIN_RATE_LIMITS_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * POST - Reset rate limits or perform admin actions
 */
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    const body = await request.json();
    const { action, identifier, category } = body as {
      action: "reset" | "clear_stats" | "check_abuse";
      identifier?: string;
      category?: RateLimitCategory;
    };

    const rateLimiter = getAPIRateLimiter();
    const monitor = getRateLimitMonitor();

    switch (action) {
      case "reset":
        if (!identifier) {
          return NextResponse.json(
            { error: "Identifier is required for reset action" },
            { status: 400 }
          );
        }
        
        if (category) {
          await rateLimiter.reset(identifier, category);
        } else {
          // Reset all categories for this identifier
          const categories: RateLimitCategory[] = [
            "general", "auth", "ai", "ai_heavy", "tts", "stt",
            "comments", "stories", "uploads", "admin", "payment"
          ];
          for (const cat of categories) {
            await rateLimiter.reset(identifier, cat);
          }
        }
        
        return NextResponse.json({
          success: true,
          message: `Rate limit reset for ${identifier}${category ? ` (${category})` : " (all categories)"}`,
        });

      case "clear_stats":
        monitor.clear();
        return NextResponse.json({
          success: true,
          message: "Rate limit statistics cleared",
        });

      case "check_abuse":
        if (!identifier) {
          return NextResponse.json(
            { error: "Identifier is required for abuse check" },
            { status: 400 }
          );
        }
        
        const report = monitor.getAbuseReport(identifier);
        return NextResponse.json({
          success: true,
          report,
        });

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[ADMIN_RATE_LIMITS_POST_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
