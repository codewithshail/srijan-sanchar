import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { printOrders, stories, users } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    await checkAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = status && status !== "all" 
      ? eq(printOrders.orderStatus, status as "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled")
      : undefined;

    // Get orders with story and user details
    const orders = await db
      .select({
        id: printOrders.id,
        storyId: printOrders.storyId,
        userId: printOrders.userId,
        orderStatus: printOrders.orderStatus,
        bookSize: printOrders.bookSize,
        coverType: printOrders.coverType,
        quantity: printOrders.quantity,
        totalAmount: printOrders.totalAmount,
        razorpayOrderId: printOrders.razorpayOrderId,
        razorpayPaymentId: printOrders.razorpayPaymentId,
        shippingAddress: printOrders.shippingAddress,
        trackingNumber: printOrders.trackingNumber,
        createdAt: printOrders.createdAt,
        updatedAt: printOrders.updatedAt,
        storyTitle: stories.title,
        userClerkId: users.clerkId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(printOrders)
      .innerJoin(stories, eq(printOrders.storyId, stories.id))
      .innerJoin(users, eq(printOrders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(printOrders.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(printOrders)
      .where(whereClause);

    const totalCount = Number(countResult?.count || 0);
    const totalPages = Math.ceil(totalCount / limit);

    // Get status counts for filters
    const statusCounts = await db
      .select({
        status: printOrders.orderStatus,
        count: sql<number>`count(*)`,
      })
      .from(printOrders)
      .groupBy(printOrders.orderStatus);

    const statusCountMap = statusCounts.reduce((acc, { status, count }) => {
      acc[status] = Number(count);
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
      statusCounts: {
        all: totalCount,
        pending: statusCountMap.pending || 0,
        paid: statusCountMap.paid || 0,
        processing: statusCountMap.processing || 0,
        shipped: statusCountMap.shipped || 0,
        delivered: statusCountMap.delivered || 0,
        cancelled: statusCountMap.cancelled || 0,
      },
    });
  } catch (error) {
    console.error("[ADMIN_GET_PRINT_ORDERS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch print orders" },
      { status: 500 }
    );
  }
}
