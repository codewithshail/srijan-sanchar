/**
 * Job Notification Service
 * Handles sending notifications when jobs complete or fail
 */

import { db } from '@/lib/db';
import { users, stories, generationJobs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export interface NotificationPayload {
  userId: string;
  storyId: string;
  jobId: string;
  jobType: 'story_generation' | 'image_generation' | 'audio_generation';
  status: 'completed' | 'failed';
  result?: Record<string, unknown>;
  error?: string;
}

export interface EmailNotificationData {
  to: string;
  subject: string;
  body: string;
  storyTitle?: string;
  storyId: string;
  jobType: string;
}

/**
 * Get user email from Clerk ID
 * Note: In production, you'd fetch this from Clerk API
 */
async function getUserEmail(userId: string): Promise<string | null> {
  // For now, we'll return null as we don't have email stored in our users table
  // In production, integrate with Clerk to get user email
  return null;
}

/**
 * Send email notification
 * Placeholder for actual email service integration (SendGrid, Resend, etc.)
 */
async function sendEmail(data: EmailNotificationData): Promise<boolean> {
  // TODO: Integrate with email service (SendGrid, Resend, AWS SES, etc.)
  console.log('[NOTIFICATION] Email notification:', {
    to: data.to,
    subject: data.subject,
    storyId: data.storyId,
    jobType: data.jobType,
  });
  
  // For now, just log the notification
  // In production, implement actual email sending
  return true;
}

/**
 * Store in-app notification in database
 * This can be used for real-time notifications via WebSocket or polling
 */
async function storeInAppNotification(
  payload: NotificationPayload
): Promise<void> {
  // For now, we'll update the generation job with notification sent flag
  // In production, you might have a separate notifications table
  try {
    await db
      .update(generationJobs)
      .set({
        result: {
          ...(typeof payload.result === 'object' ? payload.result : {}),
          notificationSent: true,
          notificationSentAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, payload.jobId));
  } catch (error) {
    console.error('[NOTIFICATION] Failed to store in-app notification:', error);
  }
}

/**
 * Get notification message based on job type and status
 */
function getNotificationMessage(
  jobType: string,
  status: 'completed' | 'failed',
  storyTitle?: string
): { subject: string; body: string } {
  const title = storyTitle || 'your story';
  
  const messages: Record<string, Record<string, { subject: string; body: string }>> = {
    story_generation: {
      completed: {
        subject: `Your story "${title}" is ready!`,
        body: `Great news! Your story has been generated successfully. You can now view, edit, and publish it.`,
      },
      failed: {
        subject: `Story generation failed for "${title}"`,
        body: `We encountered an issue while generating your story. Please try again or contact support if the problem persists.`,
      },
    },
    image_generation: {
      completed: {
        subject: `Images for "${title}" are ready!`,
        body: `The AI-generated images for your story are now available. Check out your story to see them!`,
      },
      failed: {
        subject: `Image generation failed for "${title}"`,
        body: `We couldn't generate all images for your story. Your story is still available, but some images may be missing.`,
      },
    },
    audio_generation: {
      completed: {
        subject: `Audio narration for "${title}" is ready!`,
        body: `Your story now has audio narration! You can listen to it anytime.`,
      },
      failed: {
        subject: `Audio generation failed for "${title}"`,
        body: `We encountered an issue while generating audio for your story. Please try again later.`,
      },
    },
  };

  return messages[jobType]?.[status] || {
    subject: `Job ${status} for "${title}"`,
    body: `Your ${jobType.replace('_', ' ')} job has ${status}.`,
  };
}

/**
 * Send job completion notification
 */
export async function sendJobNotification(
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch story details
    const [story] = await db
      .select({
        id: stories.id,
        title: stories.title,
        ownerId: stories.ownerId,
      })
      .from(stories)
      .where(eq(stories.id, payload.storyId));

    if (!story) {
      console.warn('[NOTIFICATION] Story not found:', payload.storyId);
      return { success: false, error: 'Story not found' };
    }

    // Fetch user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, story.ownerId));

    if (!user) {
      console.warn('[NOTIFICATION] User not found:', story.ownerId);
      return { success: false, error: 'User not found' };
    }

    // Get notification message
    const message = getNotificationMessage(
      payload.jobType,
      payload.status,
      story.title || undefined
    );

    // Store in-app notification
    await storeInAppNotification(payload);

    // Try to send email notification
    const userEmail = await getUserEmail(user.clerkId);
    if (userEmail) {
      await sendEmail({
        to: userEmail,
        subject: message.subject,
        body: message.body,
        storyTitle: story.title || undefined,
        storyId: payload.storyId,
        jobType: payload.jobType,
      });
    }

    console.log('[NOTIFICATION] Notification sent:', {
      userId: user.id,
      storyId: payload.storyId,
      jobType: payload.jobType,
      status: payload.status,
    });

    return { success: true };
  } catch (error) {
    console.error('[NOTIFICATION] Failed to send notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send batch notifications for multiple jobs
 */
export async function sendBatchNotifications(
  payloads: NotificationPayload[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const payload of payloads) {
    const result = await sendJobNotification(payload);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Notification types for in-app notifications
 */
export type NotificationType = 
  | 'story_generation_complete'
  | 'story_generation_failed'
  | 'image_generation_complete'
  | 'image_generation_failed'
  | 'audio_generation_complete'
  | 'audio_generation_failed';

/**
 * Get notification type from job type and status
 */
export function getNotificationType(
  jobType: string,
  status: 'completed' | 'failed'
): NotificationType {
  return `${jobType}_${status === 'completed' ? 'complete' : 'failed'}` as NotificationType;
}
