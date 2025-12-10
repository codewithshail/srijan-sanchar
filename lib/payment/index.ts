export {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  fetchOrder,
  refundPayment,
  razorpay,
} from "./razorpay";

export type {
  CreateOrderParams,
  RazorpayOrder,
  VerifyPaymentParams,
} from "./razorpay";

// Payment Security exports
export {
  // Signature verification
  verifyPaymentSignatureSecure,
  verifyWebhookSignatureSecure,
  // Amount validation
  validatePaymentAmount,
  validateOrderAmount,
  calculateExpectedAmount,
  // Double payment prevention
  checkDoublePayment,
  checkDuplicatePaymentId,
  // Encryption
  encryptSensitiveData,
  decryptSensitiveData,
  encryptShippingAddress,
  decryptShippingAddress,
  hashForLogging,
  maskSensitiveData,
  // Fraud detection
  performFraudCheck,
  // Comprehensive validation
  validatePaymentComprehensive,
  // Audit logging
  logPaymentEvent,
  // Utilities
  generateIdempotencyKey,
  isValidRazorpayOrderId,
  isValidRazorpayPaymentId,
  // Error codes
  PaymentErrorCode,
} from "./payment-security";

export type {
  PaymentValidationResult,
  FraudCheckResult,
  PaymentAttempt,
  ComprehensiveValidationParams,
  ComprehensiveValidationResult,
  PaymentAuditLog,
} from "./payment-security";
