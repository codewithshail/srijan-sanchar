import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentFlags } from "@/lib/db/schema";
import { eq, count, sql, and, gte } from "drizzle-orm";
import { isUserAdmin } from "@/lib/auth";

/**
 * GET /api/admin/moderation/stats
 * Get moderation statistics
 */
export async function GET(_request: NextRequest) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Get counts by status
    const statusCounts = await db
      .select({
        status: contentFlags.status,
        count: count(),
      })
      .from(contentFlags)
      .groupBy(contentFlags.status);

    // Get counts by reason
    const reasonCounts = await db
      .select({
        reason: contentFlags.reason,
        count: count(),
      })
      .from(contentFlags)
      .groupBy(contentFlags.reason);

    // Get counts by content type
    const contentTypeCounts = await db
      .select({
        contentType: contentFlags.contentType,
        count: count(),
      })
      .from(contentFlags)
      .groupBy(contentFlags.contentType);

    // Get auto-detected vs manual counts
    const detectionCounts = await db
      .select({
        autoDetected: contentFlags.autoDetected,
        count: count(),
      })
      .from(contentFlags)
      .groupBy(contentFlags.autoDetected);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentFlags = await db
      .select({ count: count() })
      .from(contentFlags)
      .where(gte(contentFlags.createdAt, sevenDaysAgo));

    const recentResolved = await db
      .select({ count: count() })
      .from(contentFlags)
      .where(
        and(
          gte(contentFlags.resolvedAt, sevenDaysAgo),
          sql`${contentFlags.status} != 'pending'`
        )
      );

    // Format response
    const stats = {
      byStatus: Object.fromEntries(
        statusCounts.map(({ status, count }) => [status, count])
      ),
      byReason: Object.fromEntries(
        reasonCounts.map(({ reason, count }) => [reason, count])
      ),
      byContentType: Object.fromEntries(
        contentTypeCounts.map(({ contentType, count }) => [contentType, count])
      ),
      byDetection: {
        autoDetected: detectionCounts.find(d => d.autoDetected)?.count || 0,
        userReported: detectionCounts.find(d => !d.autoDetected)?.count || 0,
      },
      recentActivity: {
        flagsLast7Days: recentFlags[0]?.count || 0,
        resolvedLast7Days: recentResolved[0]?.count || 0,
      },
      total: statusCounts.reduce((sum, { count }) => sum + count, 0),
      pending: statusCounts.find(s => s.status === 'pending')?.count || 0,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[ADMIN_MODERATION_STATS_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
