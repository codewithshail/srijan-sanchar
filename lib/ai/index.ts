/**
 * Unified AI Service Layer
 * Central access point for all AI services with consistent error handling
 */

export { geminiService, GeminiService } from "./gemini-service";
export { imagenService, ImagenService } from "./imagen-service";
export { sttService, STTService, SUPPORTED_STT_LANGUAGES } from "./stt-service";
export { sarvamTTS, SarvamTTSService, SUPPORTED_LANGUAGES as SUPPORTED_TTS_LANGUAGES, AVAILABLE_SPEAKERS } from "./sarvam-tts";
export { rateLimiter, RateLimiter } from "./rate-limiter";

export type {
  AIServiceConfig,
  AIServiceError,
  GenerationConfig,
  ImageGenerationRequest,
  ImageGenerationResult,
  TTSRequest,
  TTSResponse,
  STTRequest,
  STTResponse,
  STTStreamOptions,
} from "./types";

/**
 * Unified AI Service Manager
 * Provides a single interface to all AI services
 */
export class AIServiceManager {
  constructor() {
    this.checkConfiguration();
  }

  /**
   * Check which services are configured
   */
  private checkConfiguration() {
    const services = {
      gemini: geminiService.isConfigured(),
      imagen: imagenService.isConfigured(),
      stt: sttService.isConfigured(),
      tts: sarvamTTS.isConfigured(),
    };

    console.log("[AI_SERVICE_MANAGER] Service configuration:", services);

    if (!services.gemini) {
      console.warn("[AI_SERVICE_MANAGER] Gemini service not configured");
    }
    if (!services.imagen) {
      console.warn("[AI_SERVICE_MANAGER] Imagen service not configured");
    }
    if (!services.stt) {
      console.warn("[AI_SERVICE_MANAGER] STT service not configured");
    }
    if (!services.tts) {
      console.warn("[AI_SERVICE_MANAGER] TTS service not configured");
    }

    return services;
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      gemini: {
        configured: geminiService.isConfigured(),
        remaining: rateLimiter.getRemainingRequests("gemini"),
      },
      imagen: {
        configured: imagenService.isConfigured(),
        remaining: rateLimiter.getRemainingRequests("imagen"),
      },
      stt: {
        configured: sttService.isConfigured(),
        remaining: rateLimiter.getRemainingRequests("stt"),
      },
      tts: {
        configured: sarvamTTS.isConfigured(),
        remaining: rateLimiter.getRemainingRequests("tts"),
      },
    };
  }

  /**
   * Clear rate limits for all services
   */
  clearRateLimits() {
    rateLimiter.clear("gemini");
    rateLimiter.clear("imagen");
    rateLimiter.clear("stt");
    rateLimiter.clear("tts");
  }
}

// Export singleton instance
export const aiServiceManager = new AIServiceManager();

// Re-export services for direct access
import { geminiService } from "./gemini-service";
import { imagenService } from "./imagen-service";
import { sttService } from "./stt-service";
import { sarvamTTS } from "./sarvam-tts";
import { rateLimiter } from "./rate-limiter";
