import { NextRequest, NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { printOrders, stories, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendOrderStatusNotification } from "@/lib/notifications/order-notifications";

const updateOrderSchema = z.object({
  orderStatus: z.enum(["pending", "paid", "processing", "shipped", "delivered", "cancelled"]).optional(),
  trackingNumber: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await checkAdmin();
    const { orderId } = await params;

    const [order] = await db
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
        storyContent: stories.content,
        userClerkId: users.clerkId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(printOrders)
      .innerJoin(stories, eq(printOrders.storyId, stories.id))
      .innerJoin(users, eq(printOrders.userId, users.id))
      .where(eq(printOrders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("[ADMIN_GET_ORDER_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await checkAdmin();
    const { orderId } = await params;

    const body = await req.json();
    const validationResult = updateOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { orderStatus, trackingNumber } = validationResult.data;

    // Get current order to check status change
    const [currentOrder] = await db
      .select({
        id: printOrders.id,
        orderStatus: printOrders.orderStatus,
        userId: printOrders.userId,
        storyId: printOrders.storyId,
      })
      .from(printOrders)
      .where(eq(printOrders.id, orderId))
      .limit(1);

    if (!currentOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (orderStatus) {
      updateData.orderStatus = orderStatus;
    }

    if (trackingNumber !== undefined) {
      updateData.trackingNumber = trackingNumber;
    }

    // Update the order
    const [updatedOrder] = await db
      .update(printOrders)
      .set(updateData)
      .where(eq(printOrders.id, orderId))
      .returning();

    // Send notification if status changed
    if (orderStatus && orderStatus !== currentOrder.orderStatus) {
      // Get user and story details for notification
      const [orderDetails] = await db
        .select({
          storyTitle: stories.title,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userClerkId: users.clerkId,
          shippingAddress: printOrders.shippingAddress,
        })
        .from(printOrders)
        .innerJoin(stories, eq(printOrders.storyId, stories.id))
        .innerJoin(users, eq(printOrders.userId, users.id))
        .where(eq(printOrders.id, orderId))
        .limit(1);

      if (orderDetails) {
        // Only send notifications for meaningful status changes
        const notifiableStatuses = ['processing', 'shipped', 'delivered', 'cancelled'] as const;
        if (notifiableStatuses.includes(orderStatus as typeof notifiableStatuses[number])) {
          // Send notification asynchronously
          sendOrderStatusNotification({
            orderId,
            userId: currentOrder.userId,
            storyTitle: orderDetails.storyTitle || "Untitled Story",
            userName: `${orderDetails.userFirstName || ""} ${orderDetails.userLastName || ""}`.trim() || "Customer",
            status: orderStatus as 'processing' | 'shipped' | 'delivered' | 'cancelled',
            trackingNumber: trackingNumber || updatedOrder.trackingNumber || undefined,
          }).catch((err) => {
            console.error("[ORDER_NOTIFICATION_ERROR]", err);
          });
        }
      }
    }

    return NextResponse.json({
      ...updatedOrder,
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("[ADMIN_UPDATE_ORDER_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
