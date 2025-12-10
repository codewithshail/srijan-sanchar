/**
 * Order Notification Service
 * Handles sending notifications for print order status updates
 */

import { db } from '@/lib/db';
import { users, stories, printOrders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface OrderNotificationPayload {
  orderId: string;
  userId: string;
  storyTitle: string;
  userName: string;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
}

export interface OrderConfirmationPayload {
  orderId: string;
  userId: string;
  storyTitle: string;
  userName: string;
  bookSize: string;
  coverType: string;
  quantity: number;
  totalAmount: number;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
  };
}

/**
 * Get notification message based on order status
 */
function getStatusNotificationMessage(
  status: string,
  storyTitle: string
): { subject: string; body: string } {
  const messages: Record<string, { subject: string; body: string }> = {
    processing: {
      subject: `Your order for "${storyTitle}" is being prepared`,
      body: `Great news! Your book is now being printed and prepared for shipping. We'll notify you once it's on its way.`,
    },
    shipped: {
      subject: `Your order for "${storyTitle}" has shipped!`,
      body: `Your book is on its way! You can track your package using the tracking information in your dashboard.`,
    },
    delivered: {
      subject: `Your order for "${storyTitle}" has been delivered!`,
      body: `Your book has been delivered. We hope you enjoy your printed story!`,
    },
    cancelled: {
      subject: `Order cancelled for "${storyTitle}"`,
      body: `Your order has been cancelled. If you have any questions, please contact our support team.`,
    },
  };

  return messages[status] || {
    subject: `Order update for "${storyTitle}"`,
    body: `There's an update to your order.`,
  };
}

/**
 * Send email notification (placeholder for actual email service)
 */
async function sendEmail(
  to: string,
  subject: string,
  body: string,
  htmlContent?: string
): Promise<boolean> {
  // TODO: Integrate with email service (SendGrid, Resend, AWS SES, etc.)
  console.log('[ORDER_NOTIFICATION] Email notification:', {
    to,
    subject,
    bodyPreview: body.substring(0, 100),
  });
  
  // For now, just log the notification
  // In production, implement actual email sending
  return true;
}

/**
 * Send order status update notification
 */
export async function sendOrderStatusNotification(
  payload: OrderNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const message = getStatusNotificationMessage(payload.status, payload.storyTitle);

    // Log the notification (in production, send actual email)
    console.log('[ORDER_NOTIFICATION] Status update:', {
      orderId: payload.orderId,
      userId: payload.userId,
      status: payload.status,
      subject: message.subject,
    });

    // In production, you would:
    // 1. Get user email from Clerk
    // 2. Render the OrderStatusEmail component to HTML
    // 3. Send via email service

    // For now, we'll just log it
    await sendEmail(
      'user@example.com', // Would be actual user email
      message.subject,
      message.body
    );

    return { success: true };
  } catch (error) {
    console.error('[ORDER_NOTIFICATION] Failed to send status notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send order confirmation notification
 */
export async function sendOrderConfirmationNotification(
  payload: OrderConfirmationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = `Order confirmed for "${payload.storyTitle}"`;
    const body = `Thank you for your order! Your book will be printed and shipped within 5-7 business days.`;

    console.log('[ORDER_NOTIFICATION] Order confirmation:', {
      orderId: payload.orderId,
      userId: payload.userId,
      totalAmount: payload.totalAmount,
    });

    // In production, you would:
    // 1. Get user email from Clerk
    // 2. Render the OrderConfirmationEmail component to HTML
    // 3. Send via email service

    await sendEmail(
      'user@example.com', // Would be actual user email
      subject,
      body
    );

    return { success: true };
  } catch (error) {
    console.error('[ORDER_NOTIFICATION] Failed to send confirmation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send admin notification for new order
 */
export async function sendAdminNewOrderNotification(
  orderId: string,
  storyTitle: string,
  totalAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const subject = `New print order received - ${storyTitle}`;
    const body = `A new print order has been placed. Order ID: ${orderId}, Amount: ₹${(totalAmount / 100).toFixed(2)}`;

    console.log('[ORDER_NOTIFICATION] Admin notification:', {
      orderId,
      storyTitle,
      totalAmount,
    });

    // In production, send to admin email
    await sendEmail(
      'admin@storyweave.app',
      subject,
      body
    );

    return { success: true };
  } catch (error) {
    console.error('[ORDER_NOTIFICATION] Failed to send admin notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get order details for notification
 */
export async function getOrderDetailsForNotification(orderId: string) {
  const [order] = await db
    .select({
      id: printOrders.id,
      userId: printOrders.userId,
      storyId: printOrders.storyId,
      orderStatus: printOrders.orderStatus,
      bookSize: printOrders.bookSize,
      coverType: printOrders.coverType,
      quantity: printOrders.quantity,
      totalAmount: printOrders.totalAmount,
      shippingAddress: printOrders.shippingAddress,
      trackingNumber: printOrders.trackingNumber,
      storyTitle: stories.title,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      userClerkId: users.clerkId,
    })
    .from(printOrders)
    .innerJoin(stories, eq(printOrders.storyId, stories.id))
    .innerJoin(users, eq(printOrders.userId, users.id))
    .where(eq(printOrders.id, orderId))
    .limit(1);

  return order;
}
