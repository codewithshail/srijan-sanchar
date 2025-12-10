import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { printOrders, stories, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { 
  verifyWebhookSignatureSecure,
  checkDuplicatePaymentId,
  logPaymentEvent,
  PaymentErrorCode,
} from "@/lib/payment";
import { 
  sendOrderConfirmationNotification, 
  sendAdminNewOrderNotification 
} from "@/lib/notifications/order-notifications";

// Razorpay webhook events
interface RazorpayWebhookEvent {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        order_id: string;
        method: string;
        captured: boolean;
        notes: Record<string, string>;
        created_at: number;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        amount_paid: number;
        amount_due: number;
        currency: string;
        receipt: string;
        status: string;
        notes: Record<string, string>;
      };
    };
  };
  created_at: number;
}

export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      console.error("Missing Razorpay signature");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature using secure timing-safe comparison
    const signatureResult = verifyWebhookSignatureSecure(rawBody, signature);
    if (!signatureResult.valid) {
      console.error("Invalid Razorpay webhook signature:", signatureResult.error);
      logPaymentEvent({
        timestamp: new Date(),
        eventType: "signature_invalid",
        orderId: "webhook",
        userId: "system",
        amount: 0,
        errorCode: PaymentErrorCode.INVALID_SIGNATURE,
        metadata: { source: "webhook" },
      });
      return NextResponse.json(
        { error: signatureResult.error || "Invalid signature" },
        { status: 400 }
      );
    }

    // Parse the webhook event
    const event: RazorpayWebhookEvent = JSON.parse(rawBody);
    console.log("Razorpay webhook event:", event.event);

    // Handle different event types
    switch (event.event) {
      case "payment.captured":
        await handlePaymentCaptured(event);
        break;

      case "payment.failed":
        await handlePaymentFailed(event);
        break;

      case "order.paid":
        await handleOrderPaid(event);
        break;

      case "refund.created":
        await handleRefundCreated(event);
        break;

      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing Razorpay webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handlePaymentCaptured(event: RazorpayWebhookEvent) {
  const payment = event.payload.payment?.entity;
  if (!payment) return;

  console.log(`Payment captured: ${payment.id} for order ${payment.order_id}`);

  // Check for duplicate payment ID to prevent double processing
  const duplicateCheck = await checkDuplicatePaymentId(payment.id);
  if (!duplicateCheck.valid) {
    console.warn(`[WEBHOOK] Duplicate payment ID detected: ${payment.id}`);
    logPaymentEvent({
      timestamp: new Date(),
      eventType: "payment_failure",
      orderId: "webhook",
      userId: "system",
      amount: payment.amount,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      errorCode: PaymentErrorCode.DUPLICATE_PAYMENT,
      metadata: { source: "webhook" },
    });
    return;
  }

  // Find the print order by Razorpay order ID with story and user details
  const [orderDetails] = await db
    .select({
      id: printOrders.id,
      storyId: printOrders.storyId,
      userId: printOrders.userId,
      orderStatus: printOrders.orderStatus,
      bookSize: printOrders.bookSize,
      coverType: printOrders.coverType,
      quantity: printOrders.quantity,
      totalAmount: printOrders.totalAmount,
      shippingAddress: printOrders.shippingAddress,
      storyTitle: stories.title,
      userFirstName: users.firstName,
      userLastName: users.lastName,
    })
    .from(printOrders)
    .innerJoin(stories, eq(printOrders.storyId, stories.id))
    .innerJoin(users, eq(printOrders.userId, users.id))
    .where(eq(printOrders.razorpayOrderId, payment.order_id))
    .limit(1);

  if (!orderDetails) {
    console.error(`Print order not found for Razorpay order: ${payment.order_id}`);
    logPaymentEvent({
      timestamp: new Date(),
      eventType: "payment_failure",
      orderId: "unknown",
      userId: "system",
      amount: payment.amount,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      errorCode: PaymentErrorCode.ORDER_NOT_FOUND,
      metadata: { source: "webhook" },
    });
    return;
  }

  // Validate payment amount matches order amount
  if (payment.amount !== orderDetails.totalAmount) {
    console.error(
      `[WEBHOOK] Amount mismatch for order ${orderDetails.id}: expected ${orderDetails.totalAmount}, got ${payment.amount}`
    );
    logPaymentEvent({
      timestamp: new Date(),
      eventType: "payment_failure",
      orderId: orderDetails.id,
      userId: orderDetails.userId,
      amount: payment.amount,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      errorCode: PaymentErrorCode.AMOUNT_MISMATCH,
      metadata: { 
        source: "webhook",
        expectedAmount: orderDetails.totalAmount,
        actualAmount: payment.amount,
      },
    });
    return;
  }

  // Update order status if not already paid
  if (orderDetails.orderStatus === "pending") {
    await db
      .update(printOrders)
      .set({
        orderStatus: "paid",
        razorpayPaymentId: payment.id,
        updatedAt: new Date(),
      })
      .where(eq(printOrders.id, orderDetails.id));

    console.log(`Print order ${orderDetails.id} marked as paid via webhook`);

    // Log successful payment
    logPaymentEvent({
      timestamp: new Date(),
      eventType: "payment_success",
      orderId: orderDetails.id,
      userId: orderDetails.userId,
      amount: payment.amount,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      metadata: { source: "webhook" },
    });

    // Send order confirmation notification
    const shippingAddress = orderDetails.shippingAddress as {
      fullName: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      phone: string;
    };

    sendOrderConfirmationNotification({
      orderId: orderDetails.id,
      userId: orderDetails.userId,
      storyTitle: orderDetails.storyTitle || "Untitled Story",
      userName: `${orderDetails.userFirstName || ""} ${orderDetails.userLastName || ""}`.trim() || shippingAddress.fullName,
      bookSize: orderDetails.bookSize,
      coverType: orderDetails.coverType,
      quantity: orderDetails.quantity,
      totalAmount: orderDetails.totalAmount,
      shippingAddress,
    }).catch((err) => {
      console.error("[WEBHOOK] Failed to send order confirmation:", err);
    });

    // Send admin notification
    sendAdminNewOrderNotification(
      orderDetails.id,
      orderDetails.storyTitle || "Untitled Story",
      orderDetails.totalAmount
    ).catch((err) => {
      console.error("[WEBHOOK] Failed to send admin notification:", err);
    });
  }
}

async function handlePaymentFailed(event: RazorpayWebhookEvent) {
  const payment = event.payload.payment?.entity;
  if (!payment) return;

  console.log(`Payment failed: ${payment.id} for order ${payment.order_id}`);

  // Find the print order by Razorpay order ID
  const [printOrder] = await db
    .select()
    .from(printOrders)
    .where(eq(printOrders.razorpayOrderId, payment.order_id))
    .limit(1);

  if (!printOrder) {
    console.error(`Print order not found for Razorpay order: ${payment.order_id}`);
    return;
  }

  // Log the failure but don't change status - user can retry
  console.log(`Payment failed for print order ${printOrder.id}`);
}

async function handleOrderPaid(event: RazorpayWebhookEvent) {
  const order = event.payload.order?.entity;
  if (!order) return;

  console.log(`Order paid: ${order.id}`);

  // Find the print order by Razorpay order ID
  const [printOrder] = await db
    .select()
    .from(printOrders)
    .where(eq(printOrders.razorpayOrderId, order.id))
    .limit(1);

  if (!printOrder) {
    console.error(`Print order not found for Razorpay order: ${order.id}`);
    return;
  }

  // Update order status if not already paid
  if (printOrder.orderStatus === "pending") {
    await db
      .update(printOrders)
      .set({
        orderStatus: "paid",
        updatedAt: new Date(),
      })
      .where(eq(printOrders.id, printOrder.id));

    console.log(`Print order ${printOrder.id} marked as paid via order.paid webhook`);
  }
}

async function handleRefundCreated(event: RazorpayWebhookEvent) {
  // Handle refund if needed
  console.log(`Refund created event received at ${event.created_at}`);
  // You can implement refund handling logic here
}
