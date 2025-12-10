import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { printOrders, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createRazorpayOrder } from "@/lib/payment/razorpay";
import { 
  validatePaymentAmount,
  checkDoublePayment,
  performFraudCheck,
  logPaymentEvent,
  PaymentErrorCode,
} from "@/lib/payment";
import { 
  checkRateLimit, 
  recordRateLimitedRequest,
  getRateLimitErrorResponse 
} from "@/lib/rate-limiting";

const createOrderSchema = z.object({
  printOrderId: z.string().uuid("Invalid print order ID"),
});

export async function POST(req: NextRequest) {
  try {
    // Check rate limit for payment requests (stricter limits for security)
    const { allowed, result } = await checkRateLimit(req, "payment", "user");
    if (!allowed && result) {
      return getRateLimitErrorResponse(result);
    }

    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Record the request after successful auth
    await recordRateLimitedRequest(req, "payment", "user");

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
    const validationResult = createOrderSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { printOrderId } = validationResult.data;

    // Fetch the print order
    const [printOrder] = await db
      .select()
      .from(printOrders)
      .where(eq(printOrders.id, printOrderId))
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

    // Get client IP and user agent for fraud detection
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                      req.headers.get("x-real-ip") || 
                      "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Check for double payment using security module
    const doublePaymentCheck = await checkDoublePayment(printOrderId);
    if (!doublePaymentCheck.valid) {
      logPaymentEvent({
        timestamp: new Date(),
        eventType: "payment_failure",
        orderId: printOrderId,
        userId: user.id,
        amount: printOrder.totalAmount,
        ipAddress,
        userAgent,
        errorCode: doublePaymentCheck.errorCode,
      });
      return NextResponse.json(
        { error: doublePaymentCheck.error },
        { status: 400 }
      );
    }

    // Validate payment amount
    const amountValidation = validatePaymentAmount({
      amount: printOrder.totalAmount,
      quantity: printOrder.quantity,
      bookSize: printOrder.bookSize,
      coverType: printOrder.coverType,
    });

    if (!amountValidation.valid) {
      logPaymentEvent({
        timestamp: new Date(),
        eventType: "payment_failure",
        orderId: printOrderId,
        userId: user.id,
        amount: printOrder.totalAmount,
        ipAddress,
        userAgent,
        errorCode: amountValidation.errorCode,
      });
      return NextResponse.json(
        { error: amountValidation.error },
        { status: 400 }
      );
    }

    // Perform fraud check before creating payment order
    const fraudCheck = await performFraudCheck({
      userId: user.id,
      orderId: printOrderId,
      amount: printOrder.totalAmount,
      timestamp: new Date(),
      ipAddress,
      userAgent,
    });

    if (fraudCheck.recommendation === "block") {
      logPaymentEvent({
        timestamp: new Date(),
        eventType: "fraud_detected",
        orderId: printOrderId,
        userId: user.id,
        amount: printOrder.totalAmount,
        ipAddress,
        userAgent,
        errorCode: PaymentErrorCode.FRAUD_DETECTED,
        fraudScore: fraudCheck.riskScore,
        fraudFlags: fraudCheck.flags,
      });
      return NextResponse.json(
        { error: "Payment blocked due to security concerns. Please contact support." },
        { status: 403 }
      );
    }

    // Check if a Razorpay order already exists
    if (printOrder.razorpayOrderId) {
      // Return existing order details
      return NextResponse.json({
        orderId: printOrder.razorpayOrderId,
        amount: printOrder.totalAmount,
        currency: "INR",
        printOrderId: printOrder.id,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      });
    }

    // Log payment attempt
    logPaymentEvent({
      timestamp: new Date(),
      eventType: "payment_attempt",
      orderId: printOrderId,
      userId: user.id,
      amount: printOrder.totalAmount,
      ipAddress,
      userAgent,
      fraudScore: fraudCheck.riskScore,
      fraudFlags: fraudCheck.flags,
    });

    // Create Razorpay order
    const razorpayOrder = await createRazorpayOrder({
      amount: printOrder.totalAmount,
      currency: "INR",
      receipt: `print_order_${printOrder.id}`,
      notes: {
        printOrderId: printOrder.id,
        userId: user.id,
        storyId: printOrder.storyId,
      },
    });

    // Update print order with Razorpay order ID
    await db
      .update(printOrders)
      .set({
        razorpayOrderId: razorpayOrder.id,
        updatedAt: new Date(),
      })
      .where(eq(printOrders.id, printOrderId));

    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      printOrderId: printOrder.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return NextResponse.json(
      { error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
