import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { printOrders, users, stories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  validatePaymentComprehensive,
  logPaymentEvent,
  PaymentErrorCode,
  isValidRazorpayOrderId,
  isValidRazorpayPaymentId,
} from "@/lib/payment";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().refine(isValidRazorpayOrderId, {
    message: "Invalid Razorpay order ID format",
  }),
  razorpay_payment_id: z.string().refine(isValidRazorpayPaymentId, {
    message: "Invalid Razorpay payment ID format",
  }),
  razorpay_signature: z.string().min(64, "Invalid signature format"),
  printOrderId: z.string().uuid("Invalid print order ID"),
});

export async function POST(req: NextRequest) {
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

    // Parse and validate request body
    const body = await req.json();
    const validationResult = verifyPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      printOrderId,
    } = validationResult.data;

    // Get client IP and user agent for fraud detection
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Fetch the print order
    const [printOrder] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.id, printOrderId))
      .limit(1);

    if (!printOrder) {
      logPaymentEvent({
        timestamp: new Date(),
        eventType: "payment_failure",
        orderId: printOrderId,
        userId: user.id,
        amount: 0,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        ipAddress,
        userAgent,
        errorCode: PaymentErrorCode.ORDER_NOT_FOUND,
      });
      return NextResponse.json({ error: "Print order not found" }, { status: 404 });
    }

    // Verify the order belongs to the user
    if (printOrder.userId !== user.id) {
      logPaymentEvent({
        timestamp: new Date(),
        eventType: "payment_failure",
        orderId: printOrderId,
        userId: user.id,
        amount: printOrder.totalAmount,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        ipAddress,
        userAgent,
        errorCode: PaymentErrorCode.FRAUD_DETECTED,
        metadata: { reason: "user_mismatch" },
      });
      return NextResponse.json(
        { error: "You don't have permission to verify this payment" },
        { status: 403 }
      );
    }

    // Verify the Razorpay order ID matches
    if (printOrder.razorpayOrderId !== razorpay_order_id) {
      logPaymentEvent({
        timestamp: new Date(),
        eventType: "payment_failure",
        orderId: printOrderId,
        userId: user.id,
        amount: printOrder.totalAmount,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        ipAddress,
        userAgent,
        errorCode: PaymentErrorCode.INVALID_ORDER_STATE,
        metadata: { reason: "order_id_mismatch" },
      });
      return NextResponse.json(
        { error: "Order ID mismatch" },
        { status: 400 }
      );
    }

    // Log payment attempt
    logPaymentEvent({
      timestamp: new Date(),
      eventType: "payment_attempt",
      orderId: printOrderId,
      userId: user.id,
      amount: printOrder.totalAmount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      ipAddress,
      userAgent,
    });

    // Perform comprehensive payment validation (signature, double payment, fraud)
    const validationResponse = await validatePaymentComprehensive({
      orderId: printOrderId,
      userId: user.id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount: printOrder.totalAmount,
      ipAddress,
      userAgent,
    });

    if (!validationResponse.valid) {
      logPaymentEvent({
        timestamp: new Date(),
        eventType: validationResponse.errorCode === PaymentErrorCode.FRAUD_DETECTED 
          ? "fraud_detected" 
          : validationResponse.errorCode === PaymentErrorCode.INVALID_SIGNATURE
          ? "signature_invalid"
          : "payment_failure",
        orderId: printOrderId,
        userId: user.id,
        amount: printOrder.totalAmount,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        ipAddress,
        userAgent,
        errorCode: validationResponse.errorCode,
        fraudScore: validationResponse.fraudCheck?.riskScore,
        fraudFlags: validationResponse.fraudCheck?.flags,
      });

      // Return appropriate error response
      const statusCode = validationResponse.errorCode === PaymentErrorCode.FRAUD_DETECTED 
        ? 403 
        : 400;
      
      return NextResponse.json(
        { error: validationResponse.error },
        { status: statusCode }
      );
    }

    // Log if payment needs review (medium risk)
    if (validationResponse.fraudCheck?.recommendation === "review") {
      console.warn(
        `[PAYMENT_VERIFY] Payment needs review for order ${printOrderId}:`,
        validationResponse.fraudCheck
      );
    }

    // Update print order status to paid
    const [updatedOrder] = await db
      .update(printOrders)
      .set({
        orderStatus: "paid",
        razorpayPaymentId: razorpay_payment_id,
        updatedAt: new Date(),
      })
      .where(eq(printOrders.id, printOrderId))
      .returning();

    // Log successful payment
    logPaymentEvent({
      timestamp: new Date(),
      eventType: "payment_success",
      orderId: printOrderId,
      userId: user.id,
      amount: printOrder.totalAmount,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      ipAddress,
      userAgent,
      fraudScore: validationResponse.fraudCheck?.riskScore,
      fraudFlags: validationResponse.fraudCheck?.flags,
    });

    // Fetch story details for email
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, printOrder.storyId))
      .limit(1);

    // Send confirmation email (non-blocking)
    sendConfirmationEmail(user, updatedOrder, story).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      order: {
        id: updatedOrder.id,
        status: updatedOrder.orderStatus,
        paymentId: updatedOrder.razorpayPaymentId,
      },
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}

async function sendConfirmationEmail(
  user: { firstName: string | null; lastName: string | null },
  order: typeof printOrders.$inferSelect,
  story: { title: string | null } | undefined
) {
  const shippingAddress = order.shippingAddress as {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };

  try {
    // Note: In production, you'd want to get the user's email from Clerk
    // For now, we'll skip if no email service is configured
    if (!process.env.RESEND_API_KEY) {
      console.log("Email service not configured, skipping confirmation email");
      return;
    }

    await resend.emails.send({
      from: "StoryWeave <noreply@storyweave.app>",
      to: shippingAddress.fullName, // In production, use actual email
      subject: `Order Confirmed - ${story?.title || "Your Story"}`,
      html: `
        <h1>Thank you for your order!</h1>
        <p>Hi ${user.firstName || "there"},</p>
        <p>Your print order has been confirmed and is being processed.</p>
        
        <h2>Order Details</h2>
        <ul>
          <li><strong>Order ID:</strong> ${order.id}</li>
          <li><strong>Story:</strong> ${story?.title || "Untitled"}</li>
          <li><strong>Book Size:</strong> ${order.bookSize}</li>
          <li><strong>Cover Type:</strong> ${order.coverType}</li>
          <li><strong>Quantity:</strong> ${order.quantity}</li>
          <li><strong>Total Amount:</strong> ₹${(order.totalAmount / 100).toLocaleString()}</li>
        </ul>
        
        <h2>Shipping Address</h2>
        <p>
          ${shippingAddress.fullName}<br>
          ${shippingAddress.addressLine1}<br>
          ${shippingAddress.addressLine2 ? shippingAddress.addressLine2 + "<br>" : ""}
          ${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.postalCode}<br>
          ${shippingAddress.country}<br>
          Phone: ${shippingAddress.phone}
        </p>
        
        <p>We'll notify you once your order is shipped with tracking information.</p>
        
        <p>Thank you for choosing StoryWeave!</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send confirmation email:", error);
  }
}
