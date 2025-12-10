/**
 * Payment Security Module
 * Implements comprehensive security measures for Razorpay payment processing
 * 
 * Features:
 * - Signature verification with timing-safe comparison
 * - Payment amount validation
 * - Double payment prevention
 * - Sensitive data encryption
 * - Fraud detection
 */

import crypto from "crypto";
import { db } from "@/lib/db";
import { printOrders, users } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface PaymentValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: PaymentErrorCode;
}

export enum PaymentErrorCode {
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  AMOUNT_MISMATCH = "AMOUNT_MISMATCH",
  DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT",
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
  ORDER_ALREADY_PAID = "ORDER_ALREADY_PAID",
  INVALID_ORDER_STATE = "INVALID_ORDER_STATE",
  FRAUD_DETECTED = "FRAUD_DETECTED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  ENCRYPTION_ERROR = "ENCRYPTION_ERROR",
}

export interface FraudCheckResult {
  passed: boolean;
  riskScore: number; // 0-100, higher = more risky
  flags: string[];
  recommendation: "allow" | "review" | "block";
}

export interface PaymentAttempt {
  userId: string;
  orderId: string;
  amount: number;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify Razorpay payment signature using timing-safe comparison
 * Prevents timing attacks by using constant-time comparison
 */
export function verifyPaymentSignatureSecure(params: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): PaymentValidationResult {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = params;

  if (!process.env.RAZORPAY_KEY_SECRET) {
    console.error("[PAYMENT_SECURITY] RAZORPAY_KEY_SECRET not configured");
    return {
      valid: false,
      error: "Payment configuration error",
      errorCode: PaymentErrorCode.INVALID_SIGNATURE,
    };
  }

  try {
    // Generate expected signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(razorpay_signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    // Ensure buffers are same length before comparison
    if (signatureBuffer.length !== expectedBuffer.length) {
      return {
        valid: false,
        error: "Invalid payment signature",
        errorCode: PaymentErrorCode.INVALID_SIGNATURE,
      };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      console.warn(
        `[PAYMENT_SECURITY] Invalid signature for order: ${razorpay_order_id}`
      );
      return {
        valid: false,
        error: "Invalid payment signature",
        errorCode: PaymentErrorCode.INVALID_SIGNATURE,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("[PAYMENT_SECURITY] Signature verification error:", error);
    return {
      valid: false,
      error: "Signature verification failed",
      errorCode: PaymentErrorCode.INVALID_SIGNATURE,
    };
  }
}

/**
 * Verify Razorpay webhook signature using timing-safe comparison
 */
export function verifyWebhookSignatureSecure(
  body: string,
  signature: string
): PaymentValidationResult {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("[PAYMENT_SECURITY] RAZORPAY_WEBHOOK_SECRET not configured");
    return {
      valid: false,
      error: "Webhook configuration error",
      errorCode: PaymentErrorCode.INVALID_SIGNATURE,
    };
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return {
        valid: false,
        error: "Invalid webhook signature",
        errorCode: PaymentErrorCode.INVALID_SIGNATURE,
      };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValid) {
      console.warn("[PAYMENT_SECURITY] Invalid webhook signature");
      return {
        valid: false,
        error: "Invalid webhook signature",
        errorCode: PaymentErrorCode.INVALID_SIGNATURE,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("[PAYMENT_SECURITY] Webhook signature verification error:", error);
    return {
      valid: false,
      error: "Webhook signature verification failed",
      errorCode: PaymentErrorCode.INVALID_SIGNATURE,
    };
  }
}


// ============================================================================
// Amount Validation
// ============================================================================

// Pricing configuration (in paise - 100 paise = ₹1)
const PRICING = {
  BASE_PRICE_PER_COPY: 99900, // ₹999
  MIN_AMOUNT: 99900, // ₹999 minimum
  MAX_AMOUNT: 10000000, // ₹1,00,000 maximum
  BOOK_SIZE_MULTIPLIERS: {
    A5: 1.0,
    A4: 1.3,
    custom: 1.5,
  } as Record<string, number>,
  COVER_TYPE_MULTIPLIERS: {
    paperback: 1.0,
    hardcover: 1.5,
  } as Record<string, number>,
};

/**
 * Validate payment amount against expected calculation
 */
export function validatePaymentAmount(params: {
  amount: number;
  quantity: number;
  bookSize: string;
  coverType: string;
}): PaymentValidationResult {
  const { amount, quantity, bookSize, coverType } = params;

  // Basic validation
  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      valid: false,
      error: "Invalid payment amount",
      errorCode: PaymentErrorCode.INVALID_AMOUNT,
    };
  }

  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
    return {
      valid: false,
      error: "Invalid quantity",
      errorCode: PaymentErrorCode.INVALID_AMOUNT,
    };
  }

  // Check amount bounds
  if (amount < PRICING.MIN_AMOUNT) {
    return {
      valid: false,
      error: `Amount below minimum (₹${PRICING.MIN_AMOUNT / 100})`,
      errorCode: PaymentErrorCode.INVALID_AMOUNT,
    };
  }

  if (amount > PRICING.MAX_AMOUNT) {
    return {
      valid: false,
      error: `Amount exceeds maximum (₹${PRICING.MAX_AMOUNT / 100})`,
      errorCode: PaymentErrorCode.INVALID_AMOUNT,
    };
  }

  // Calculate expected amount
  const sizeMultiplier = PRICING.BOOK_SIZE_MULTIPLIERS[bookSize] || 1.0;
  const coverMultiplier = PRICING.COVER_TYPE_MULTIPLIERS[coverType] || 1.0;
  const expectedAmount = Math.round(
    PRICING.BASE_PRICE_PER_COPY * quantity * sizeMultiplier * coverMultiplier
  );

  // Allow 1% tolerance for rounding differences
  const tolerance = Math.max(100, expectedAmount * 0.01);
  const difference = Math.abs(amount - expectedAmount);

  if (difference > tolerance) {
    console.warn(
      `[PAYMENT_SECURITY] Amount mismatch: expected ${expectedAmount}, got ${amount}`
    );
    return {
      valid: false,
      error: "Payment amount does not match expected value",
      errorCode: PaymentErrorCode.AMOUNT_MISMATCH,
    };
  }

  return { valid: true };
}

/**
 * Validate that the payment amount matches the stored order amount
 */
export async function validateOrderAmount(
  orderId: string,
  paymentAmount: number
): Promise<PaymentValidationResult> {
  try {
    const [order] = await db
      .select({ totalAmount: printOrders.totalAmount })
      .from(printOrders)
      .where(eq(printOrders.id, orderId))
      .limit(1);

    if (!order) {
      return {
        valid: false,
        error: "Order not found",
        errorCode: PaymentErrorCode.ORDER_NOT_FOUND,
      };
    }

    if (order.totalAmount !== paymentAmount) {
      console.warn(
        `[PAYMENT_SECURITY] Order amount mismatch for ${orderId}: expected ${order.totalAmount}, got ${paymentAmount}`
      );
      return {
        valid: false,
        error: "Payment amount does not match order",
        errorCode: PaymentErrorCode.AMOUNT_MISMATCH,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("[PAYMENT_SECURITY] Order amount validation error:", error);
    return {
      valid: false,
      error: "Failed to validate order amount",
      errorCode: PaymentErrorCode.ORDER_NOT_FOUND,
    };
  }
}

// ============================================================================
// Double Payment Prevention
// ============================================================================

/**
 * Check if an order has already been paid
 */
export async function checkDoublePayment(
  orderId: string
): Promise<PaymentValidationResult> {
  try {
    const [order] = await db
      .select({
        orderStatus: printOrders.orderStatus,
        razorpayPaymentId: printOrders.razorpayPaymentId,
      })
      .from(printOrders)
      .where(eq(printOrders.id, orderId))
      .limit(1);

    if (!order) {
      return {
        valid: false,
        error: "Order not found",
        errorCode: PaymentErrorCode.ORDER_NOT_FOUND,
      };
    }

    // Check if already paid
    if (order.orderStatus !== "pending") {
      console.warn(
        `[PAYMENT_SECURITY] Double payment attempt for order ${orderId}, status: ${order.orderStatus}`
      );
      return {
        valid: false,
        error: `Order is already ${order.orderStatus}`,
        errorCode: PaymentErrorCode.ORDER_ALREADY_PAID,
      };
    }

    // Check if payment ID already exists
    if (order.razorpayPaymentId) {
      console.warn(
        `[PAYMENT_SECURITY] Order ${orderId} already has payment ID: ${order.razorpayPaymentId}`
      );
      return {
        valid: false,
        error: "Payment already processed for this order",
        errorCode: PaymentErrorCode.DUPLICATE_PAYMENT,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("[PAYMENT_SECURITY] Double payment check error:", error);
    return {
      valid: false,
      error: "Failed to verify payment status",
      errorCode: PaymentErrorCode.INVALID_ORDER_STATE,
    };
  }
}

/**
 * Check if a payment ID has already been used
 */
export async function checkDuplicatePaymentId(
  paymentId: string
): Promise<PaymentValidationResult> {
  try {
    const [existingOrder] = await db
      .select({ id: printOrders.id })
      .from(printOrders)
      .where(eq(printOrders.razorpayPaymentId, paymentId))
      .limit(1);

    if (existingOrder) {
      console.warn(
        `[PAYMENT_SECURITY] Duplicate payment ID ${paymentId} already used for order ${existingOrder.id}`
      );
      return {
        valid: false,
        error: "Payment ID already used",
        errorCode: PaymentErrorCode.DUPLICATE_PAYMENT,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error("[PAYMENT_SECURITY] Duplicate payment ID check error:", error);
    return {
      valid: false,
      error: "Failed to verify payment ID",
      errorCode: PaymentErrorCode.DUPLICATE_PAYMENT,
    };
  }
}


// ============================================================================
// Sensitive Data Encryption
// ============================================================================

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get or generate encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PAYMENT_ENCRYPTION_KEY not configured");
  }
  // Derive a 32-byte key from the provided key using SHA-256
  return crypto.createHash("sha256").update(key).digest();
}

/**
 * Encrypt sensitive payment data
 */
export function encryptSensitiveData(data: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine IV + AuthTag + Encrypted data
    return iv.toString("hex") + authTag.toString("hex") + encrypted;
  } catch (error) {
    console.error("[PAYMENT_SECURITY] Encryption error:", error);
    throw new Error("Failed to encrypt sensitive data");
  }
}

/**
 * Decrypt sensitive payment data
 */
export function decryptSensitiveData(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Extract IV, AuthTag, and encrypted content
    const iv = Buffer.from(encryptedData.slice(0, IV_LENGTH * 2), "hex");
    const authTag = Buffer.from(
      encryptedData.slice(IV_LENGTH * 2, IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2),
      "hex"
    );
    const encrypted = encryptedData.slice(
      IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2
    );

    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[PAYMENT_SECURITY] Decryption error:", error);
    throw new Error("Failed to decrypt sensitive data");
  }
}

/**
 * Encrypt shipping address for storage
 */
export function encryptShippingAddress(address: object): string {
  return encryptSensitiveData(JSON.stringify(address));
}

/**
 * Decrypt shipping address from storage
 */
export function decryptShippingAddress<T>(encryptedAddress: string): T {
  const decrypted = decryptSensitiveData(encryptedAddress);
  return JSON.parse(decrypted) as T;
}

/**
 * Hash sensitive data for logging (one-way)
 */
export function hashForLogging(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 16);
}

/**
 * Mask sensitive data for display
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return "*".repeat(data.length);
  }
  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const masked = "*".repeat(Math.max(4, data.length - visibleChars * 2));
  return `${start}${masked}${end}`;
}

// ============================================================================
// Fraud Detection
// ============================================================================

// Fraud detection thresholds
const FRAUD_THRESHOLDS = {
  MAX_ORDERS_PER_HOUR: 5,
  MAX_ORDERS_PER_DAY: 20,
  MAX_FAILED_PAYMENTS_PER_HOUR: 3,
  SUSPICIOUS_AMOUNT_THRESHOLD: 500000, // ₹5000 in paise
  HIGH_RISK_SCORE: 70,
  MEDIUM_RISK_SCORE: 40,
};

/**
 * Perform comprehensive fraud check on payment attempt
 */
export async function performFraudCheck(
  attempt: PaymentAttempt
): Promise<FraudCheckResult> {
  const flags: string[] = [];
  let riskScore = 0;

  try {
    // Check 1: Order frequency (velocity check)
    const velocityResult = await checkOrderVelocity(attempt.userId);
    if (!velocityResult.passed) {
      flags.push(...velocityResult.flags);
      riskScore += velocityResult.riskScore;
    }

    // Check 2: Amount anomaly
    const amountResult = checkAmountAnomaly(attempt.amount);
    if (!amountResult.passed) {
      flags.push(...amountResult.flags);
      riskScore += amountResult.riskScore;
    }

    // Check 3: User account age
    const accountResult = await checkAccountAge(attempt.userId);
    if (!accountResult.passed) {
      flags.push(...accountResult.flags);
      riskScore += accountResult.riskScore;
    }

    // Check 4: Multiple orders for same story
    const duplicateResult = await checkDuplicateStoryOrders(
      attempt.userId,
      attempt.orderId
    );
    if (!duplicateResult.passed) {
      flags.push(...duplicateResult.flags);
      riskScore += duplicateResult.riskScore;
    }

    // Cap risk score at 100
    riskScore = Math.min(100, riskScore);

    // Determine recommendation
    let recommendation: FraudCheckResult["recommendation"];
    if (riskScore >= FRAUD_THRESHOLDS.HIGH_RISK_SCORE) {
      recommendation = "block";
    } else if (riskScore >= FRAUD_THRESHOLDS.MEDIUM_RISK_SCORE) {
      recommendation = "review";
    } else {
      recommendation = "allow";
    }

    const passed = recommendation === "allow";

    if (!passed) {
      console.warn(
        `[FRAUD_DETECTION] Risk detected for user ${attempt.userId}:`,
        { riskScore, flags, recommendation }
      );
    }

    return { passed, riskScore, flags, recommendation };
  } catch (error) {
    console.error("[FRAUD_DETECTION] Error during fraud check:", error);
    // On error, allow but flag for review
    return {
      passed: true,
      riskScore: 30,
      flags: ["fraud_check_error"],
      recommendation: "review",
    };
  }
}

/**
 * Check order velocity (frequency of orders)
 */
async function checkOrderVelocity(
  userId: string
): Promise<{ passed: boolean; flags: string[]; riskScore: number }> {
  const flags: string[] = [];
  let riskScore = 0;

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Count orders in last hour
  const [hourlyResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(printOrders)
    .where(
      and(eq(printOrders.userId, userId), gte(printOrders.createdAt, oneHourAgo))
    );

  const hourlyCount = hourlyResult?.count || 0;

  if (hourlyCount >= FRAUD_THRESHOLDS.MAX_ORDERS_PER_HOUR) {
    flags.push("high_order_velocity_hourly");
    riskScore += 40;
  } else if (hourlyCount >= FRAUD_THRESHOLDS.MAX_ORDERS_PER_HOUR - 2) {
    flags.push("elevated_order_velocity_hourly");
    riskScore += 15;
  }

  // Count orders in last day
  const [dailyResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(printOrders)
    .where(
      and(eq(printOrders.userId, userId), gte(printOrders.createdAt, oneDayAgo))
    );

  const dailyCount = dailyResult?.count || 0;

  if (dailyCount >= FRAUD_THRESHOLDS.MAX_ORDERS_PER_DAY) {
    flags.push("high_order_velocity_daily");
    riskScore += 30;
  } else if (dailyCount >= FRAUD_THRESHOLDS.MAX_ORDERS_PER_DAY - 5) {
    flags.push("elevated_order_velocity_daily");
    riskScore += 10;
  }

  return { passed: flags.length === 0, flags, riskScore };
}

/**
 * Check for amount anomalies
 */
function checkAmountAnomaly(
  amount: number
): { passed: boolean; flags: string[]; riskScore: number } {
  const flags: string[] = [];
  let riskScore = 0;

  // Check for suspiciously high amounts
  if (amount > FRAUD_THRESHOLDS.SUSPICIOUS_AMOUNT_THRESHOLD) {
    flags.push("high_amount");
    riskScore += 20;
  }

  // Check for unusual amounts (not matching standard pricing)
  const standardAmounts = [99900, 129870, 149850, 194805, 224775]; // Common order amounts
  const isStandardAmount = standardAmounts.some(
    (std) => Math.abs(amount - std) < 1000
  );

  if (!isStandardAmount && amount > 200000) {
    flags.push("unusual_amount");
    riskScore += 10;
  }

  return { passed: flags.length === 0, flags, riskScore };
}

/**
 * Check account age
 */
async function checkAccountAge(
  userId: string
): Promise<{ passed: boolean; flags: string[]; riskScore: number }> {
  const flags: string[] = [];
  let riskScore = 0;

  const [user] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    flags.push("user_not_found");
    return { passed: false, flags, riskScore: 50 };
  }

  const accountAgeHours =
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);

  // New accounts (less than 1 hour) are higher risk
  if (accountAgeHours < 1) {
    flags.push("very_new_account");
    riskScore += 25;
  } else if (accountAgeHours < 24) {
    flags.push("new_account");
    riskScore += 10;
  }

  return { passed: flags.length === 0, flags, riskScore };
}

/**
 * Check for duplicate orders for the same story
 */
async function checkDuplicateStoryOrders(
  userId: string,
  orderId: string
): Promise<{ passed: boolean; flags: string[]; riskScore: number }> {
  const flags: string[] = [];
  let riskScore = 0;

  // Get the story ID for this order
  const [currentOrder] = await db
    .select({ storyId: printOrders.storyId })
    .from(printOrders)
    .where(eq(printOrders.id, orderId))
    .limit(1);

  if (!currentOrder) {
    return { passed: true, flags, riskScore };
  }

  // Check for other orders for the same story
  const [duplicateResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(printOrders)
    .where(
      and(
        eq(printOrders.userId, userId),
        eq(printOrders.storyId, currentOrder.storyId),
        sql`${printOrders.id} != ${orderId}`
      )
    );

  const duplicateCount = duplicateResult?.count || 0;

  if (duplicateCount >= 3) {
    flags.push("multiple_orders_same_story");
    riskScore += 20;
  } else if (duplicateCount >= 1) {
    flags.push("duplicate_story_order");
    riskScore += 5;
  }

  return { passed: flags.length === 0, flags, riskScore };
}


// ============================================================================
// Comprehensive Payment Validation
// ============================================================================

export interface ComprehensiveValidationParams {
  orderId: string;
  userId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface ComprehensiveValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: PaymentErrorCode;
  fraudCheck?: FraudCheckResult;
}

/**
 * Perform comprehensive payment validation including all security checks
 */
export async function validatePaymentComprehensive(
  params: ComprehensiveValidationParams
): Promise<ComprehensiveValidationResult> {
  const {
    orderId,
    userId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    amount,
    ipAddress,
    userAgent,
  } = params;

  // Step 1: Verify signature
  const signatureResult = verifyPaymentSignatureSecure({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!signatureResult.valid) {
    return signatureResult;
  }

  // Step 2: Check for double payment
  const doublePaymentResult = await checkDoublePayment(orderId);
  if (!doublePaymentResult.valid) {
    return doublePaymentResult;
  }

  // Step 3: Check for duplicate payment ID
  const duplicateIdResult = await checkDuplicatePaymentId(razorpay_payment_id);
  if (!duplicateIdResult.valid) {
    return duplicateIdResult;
  }

  // Step 4: Validate order amount
  const amountResult = await validateOrderAmount(orderId, amount);
  if (!amountResult.valid) {
    return amountResult;
  }

  // Step 5: Perform fraud check
  const fraudCheck = await performFraudCheck({
    userId,
    orderId,
    amount,
    timestamp: new Date(),
    ipAddress,
    userAgent,
  });

  if (fraudCheck.recommendation === "block") {
    return {
      valid: false,
      error: "Payment blocked due to security concerns",
      errorCode: PaymentErrorCode.FRAUD_DETECTED,
      fraudCheck,
    };
  }

  return {
    valid: true,
    fraudCheck,
  };
}

// ============================================================================
// Audit Logging
// ============================================================================

export interface PaymentAuditLog {
  timestamp: Date;
  eventType: "payment_attempt" | "payment_success" | "payment_failure" | "fraud_detected" | "signature_invalid";
  orderId: string;
  userId: string;
  amount: number;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  ipAddress?: string;
  userAgent?: string;
  errorCode?: PaymentErrorCode;
  fraudScore?: number;
  fraudFlags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Log payment event for audit trail
 */
export function logPaymentEvent(log: PaymentAuditLog): void {
  // Mask sensitive data before logging
  const sanitizedLog = {
    ...log,
    razorpayPaymentId: log.razorpayPaymentId
      ? maskSensitiveData(log.razorpayPaymentId)
      : undefined,
    ipAddress: log.ipAddress ? hashForLogging(log.ipAddress) : undefined,
  };

  console.log(
    `[PAYMENT_AUDIT] ${log.eventType}:`,
    JSON.stringify(sanitizedLog, null, 2)
  );

  // In production, you would also:
  // - Write to a secure audit log database
  // - Send to a SIEM system
  // - Trigger alerts for suspicious activity
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a secure idempotency key for payment requests
 */
export function generateIdempotencyKey(orderId: string, userId: string): string {
  const data = `${orderId}:${userId}:${Date.now()}`;
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Validate Razorpay order ID format
 */
export function isValidRazorpayOrderId(orderId: string): boolean {
  // Razorpay order IDs start with "order_" followed by alphanumeric characters
  return /^order_[A-Za-z0-9]{14,}$/.test(orderId);
}

/**
 * Validate Razorpay payment ID format
 */
export function isValidRazorpayPaymentId(paymentId: string): boolean {
  // Razorpay payment IDs start with "pay_" followed by alphanumeric characters
  return /^pay_[A-Za-z0-9]{14,}$/.test(paymentId);
}

/**
 * Calculate expected payment amount
 */
export function calculateExpectedAmount(params: {
  quantity: number;
  bookSize: string;
  coverType: string;
}): number {
  const { quantity, bookSize, coverType } = params;
  const sizeMultiplier = PRICING.BOOK_SIZE_MULTIPLIERS[bookSize] || 1.0;
  const coverMultiplier = PRICING.COVER_TYPE_MULTIPLIERS[coverType] || 1.0;
  return Math.round(
    PRICING.BASE_PRICE_PER_COPY * quantity * sizeMultiplier * coverMultiplier
  );
}
