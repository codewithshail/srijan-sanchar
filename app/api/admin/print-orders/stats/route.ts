import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { printOrders } from "@/lib/db/schema";
import { sql, gte, and } from "drizzle-orm";

export async function GET() {
  try {
    await checkAdmin();

    // Get overall stats
    const [overallStats] = await db
      .select({
        totalOrders: sql<number>`count(*)`,
        totalRevenue: sql<number>`coalesce(sum(${printOrders.totalAmount}), 0)`,
        paidOrders: sql<number>`count(*) filter (where ${printOrders.orderStatus} != 'pending' and ${printOrders.orderStatus} != 'cancelled')`,
      })
      .from(printOrders);

    // Get stats by status
    const statusStats = await db
      .select({
        status: printOrders.orderStatus,
        count: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${printOrders.totalAmount}), 0)`,
      })
      .from(printOrders)
      .groupBy(printOrders.orderStatus);

    // Get recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [recentStats] = await db
      .select({
        recentOrders: sql<number>`count(*)`,
        recentRevenue: sql<number>`coalesce(sum(${printOrders.totalAmount}), 0)`,
      })
      .from(printOrders)
      .where(
        and(
          gte(printOrders.createdAt, thirtyDaysAgo),
          sql`${printOrders.orderStatus} != 'pending' and ${printOrders.orderStatus} != 'cancelled'`
        )
      );

    // Get orders by book size
    const bookSizeStats = await db
      .select({
        bookSize: printOrders.bookSize,
        count: sql<number>`count(*)`,
      })
      .from(printOrders)
      .groupBy(printOrders.bookSize);

    // Get orders by cover type
    const coverTypeStats = await db
      .select({
        coverType: printOrders.coverType,
        count: sql<number>`count(*)`,
      })
      .from(printOrders)
      .groupBy(printOrders.coverType);

    return NextResponse.json({
      overall: {
        totalOrders: Number(overallStats?.totalOrders || 0),
        totalRevenue: Number(overallStats?.totalRevenue || 0),
        paidOrders: Number(overallStats?.paidOrders || 0),
        averageOrderValue: overallStats?.paidOrders 
          ? Math.round(Number(overallStats.totalRevenue) / Number(overallStats.paidOrders))
          : 0,
      },
      byStatus: statusStats.reduce((acc, { status, count, revenue }) => {
        acc[status] = { count: Number(count), revenue: Number(revenue) };
        return acc;
      }, {} as Record<string, { count: number; revenue: number }>),
      recent: {
        orders: Number(recentStats?.recentOrders || 0),
        revenue: Number(recentStats?.recentRevenue || 0),
      },
      byBookSize: bookSizeStats.reduce((acc, { bookSize, count }) => {
        acc[bookSize] = Number(count);
        return acc;
      }, {} as Record<string, number>),
      byCoverType: coverTypeStats.reduce((acc, { coverType, count }) => {
        acc[coverType] = Number(count);
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error("[ADMIN_PRINT_ORDER_STATS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch print order stats" },
      { status: 500 }
    );
  }
}
