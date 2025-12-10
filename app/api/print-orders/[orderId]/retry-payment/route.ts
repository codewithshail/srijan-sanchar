import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { printOrders, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createRazorpayOrder } from "@/lib/payment/razorpay";

interface RouteParams {
  params: Promise<{ orderId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await params;

    // Get user from database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch the print order
    const [printOrder] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.id, orderId))
      .limit(1);

    if (!printOrder) {
      return NextResponse.json({ error: "Print order not found" }, { status: 404 });
    }

    // Verify the order belongs to the user
    if (printOrder.userId !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to pay for this order" },
        { status: 403 }
      );
    }

    // Check if order is already paid
    if (printOrder.orderStatus !== "pending") {
      return NextResponse.json(
        { error: `Order is already ${printOrder.orderStatus}` },
        { status: 400 }
      );
    }

    // Create a new Razorpay order (even if one exists, create fresh for retry)
    const razorpayOrder = await createRazorpayOrder({
      amount: printOrder.totalAmount,
      currency: "INR",
      receipt: `print_order_${printOrder.id}_retry_${Date.now()}`,
      notes: {
        printOrderId: printOrder.id,
        userId: user.id,
        storyId: printOrder.storyId,
        isRetry: "true",
      },
    });

    // Update print order with new Razorpay order ID
    await db
      .update(printOrders)
      .set({
        razorpayOrderId: razorpayOrder.id,
        updatedAt: new Date(),
      })
      .where(eq(printOrders.id, orderId));

    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      printOrderId: printOrder.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating retry payment order:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
