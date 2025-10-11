import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { printOrders, stories, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's print orders with story details
    const orders = await db
      .select({
        id: printOrders.id,
        storyId: printOrders.storyId,
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
      })
      .from(printOrders)
      .innerJoin(stories, eq(printOrders.storyId, stories.id))
      .where(eq(printOrders.userId, user.id))
      .orderBy(desc(printOrders.createdAt));

    return NextResponse.json(orders);
  } catch (error) {
    console.error("Error fetching print orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch print orders" },
      { status: 500 }
    );
  }
}
