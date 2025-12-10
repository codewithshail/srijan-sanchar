/**
 * Rate Limit Messages
 * 
 * User-friendly error messages for rate limiting:
 * - Category-specific messages
 * - Localization support
 * - Helpful suggestions for users
 * 
 * Requirements: Security (Task 36)
 */

import { NextResponse } from "next/server";
import { type RateLimitResult, type RateLimitCategory } from "./api-rate-limiter";

/**
 * Rate limit error messages by category
 */
export const RATE_LIMIT_MESSAGES: Record<RateLimitCategory, {
  title: string;
  message: string;
  suggestion: string;
}> = {
  general: {
    title: "Too Many Requests",
    message: "You've made too many requests. Please slow down.",
    suggestion: "Wait a moment before trying again.",
  },
  auth: {
    title: "Too Many Login Attempts",
    message: "You've exceeded the maximum number of login attempts.",
    suggestion: "Please wait a few minutes before trying again. If you've forgotten your password, try resetting it.",
  },
  ai: {
    title: "AI Service Limit Reached",
    message: "You've reached the limit for AI-powered features.",
    suggestion: "Wait a minute before using AI features again. Consider saving your work in the meantime.",
  },
  ai_heavy: {
    title: "Generation Limit Reached",
    message: "You've reached the limit for story or image generation.",
    suggestion: "Heavy AI operations are limited to preserve service quality. Please try again later.",
  },
  tts: {
    title: "Audio Generation Limit",
    message: "You've reached the limit for text-to-speech requests.",
    suggestion: "Wait a moment before generating more audio. Your existing audio will continue to play.",
  },
  stt: {
    title: "Voice Input Limit",
    message: "You've reached the limit for voice input requests.",
    suggestion: "Try typing your content instead, or wait a moment before using voice input again.",
  },
  comments: {
    title: "Comment Limit Reached",
    message: "You've posted too many comments recently.",
    suggestion: "Take a break and come back in a minute to continue the conversation.",
  },
  stories: {
    title: "Story Operation Limit",
    message: "You've made too many story-related requests.",
    suggestion: "Wait a moment before creating or editing more stories.",
  },
  uploads: {
    title: "Upload Limit Reached",
    message: "You've uploaded too many files recently.",
    suggestion: "Wait a minute before uploading more files.",
  },
  admin: {
    title: "Admin Action Limit",
    message: "You've performed too many admin actions.",
    suggestion: "Wait a moment before continuing with admin tasks.",
  },
  payment: {
    title: "Payment Request Limit",
    message: "You've made too many payment requests.",
    suggestion: "For security reasons, payment requests are limited. Please wait before trying again.",
  },
};

/**
 * Format a rate limit error for display
 */
export function formatRateLimitError(result: RateLimitResult): {
  title: string;
  message: string;
  suggestion: string;
  retryAfter: number | undefined;
  retryAfterFormatted: string;
} {
  const messages = RATE_LIMIT_MESSAGES[result.category] || RATE_LIMIT_MESSAGES.general;
  
  let retryAfterFormatted = "soon";
  if (result.retryAfter !== undefined) {
    if (result.retryAfter < 60) {
      retryAfterFormatted = `${result.retryAfter} second${result.retryAfter !== 1 ? "s" : ""}`;
    } else if (result.retryAfter < 3600) {
      const minutes = Math.ceil(result.retryAfter / 60);
      retryAfterFormatted = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else {
      const hours = Math.ceil(result.retryAfter / 3600);
      retryAfterFormatted = `${hours} hour${hours !== 1 ? "s" : ""}`;
    }
  }

  return {
    ...messages,
    retryAfter: result.retryAfter,
    retryAfterFormatted,
  };
}

/**
 * Create a NextResponse for rate limit errors
 */
export function getRateLimitErrorResponse(result: RateLimitResult): NextResponse {
  const error = formatRateLimitError(result);

  return NextResponse.json(
    {
      error: error.title,
      message: error.message,
      suggestion: error.suggestion,
      retryAfter: error.retryAfter,
      retryAfterFormatted: error.retryAfterFormatted,
      category: result.category,
      limit: result.limit,
      remaining: result.remaining,
      resetTime: result.resetTime,
    },
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
        ...(result.retryAfter !== undefined && {
          "Retry-After": result.retryAfter.toString(),
        }),
      },
    }
  );
}

/**
 * Get a simple error message string
 */
export function getRateLimitMessage(
  category: RateLimitCategory,
  retryAfter?: number
): string {
  const messages = RATE_LIMIT_MESSAGES[category] || RATE_LIMIT_MESSAGES.general;
  
  if (retryAfter !== undefined) {
    let timeStr: string;
    if (retryAfter < 60) {
      timeStr = `${retryAfter} second${retryAfter !== 1 ? "s" : ""}`;
    } else {
      const minutes = Math.ceil(retryAfter / 60);
      timeStr = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    }
    return `${messages.message} Please try again in ${timeStr}.`;
  }

  return `${messages.message} ${messages.suggestion}`;
}

/**
 * Localized rate limit messages (for future i18n support)
 */
export const RATE_LIMIT_MESSAGES_LOCALIZED: Record<string, Partial<Record<RateLimitCategory, {
  title: string;
  message: string;
  suggestion: string;
}>>> = {
  hi: {
    general: {
      title: "बहुत सारे अनुरोध",
      message: "आपने बहुत सारे अनुरोध किए हैं। कृपया धीमे करें।",
      suggestion: "फिर से प्रयास करने से पहले कुछ देर प्रतीक्षा करें।",
    },
    ai: {
      title: "AI सेवा सीमा पहुंच गई",
      message: "आपने AI-संचालित सुविधाओं की सीमा पूरी कर ली है।",
      suggestion: "AI सुविधाओं का फिर से उपयोग करने से पहले एक मिनट प्रतीक्षा करें।",
    },
    comments: {
      title: "टिप्पणी सीमा पहुंच गई",
      message: "आपने हाल ही में बहुत सारी टिप्पणियां पोस्ट की हैं।",
      suggestion: "बातचीत जारी रखने के लिए एक मिनट में वापस आएं।",
    },
  },
  // Add more languages as needed
};

/**
 * Get localized rate limit message
 */
export function getLocalizedRateLimitMessage(
  category: RateLimitCategory,
  locale: string = "en"
): { title: string; message: string; suggestion: string } {
  const localizedMessages = RATE_LIMIT_MESSAGES_LOCALIZED[locale];
  
  if (localizedMessages && localizedMessages[category]) {
    return localizedMessages[category]!;
  }

  return RATE_LIMIT_MESSAGES[category] || RATE_LIMIT_MESSAGES.general;
}
