/**
 * Google Imagen-4 AI Image Generation Service
 * Generates contextual images for stories
 */

import { rateLimiter } from "./rate-limiter";
import { AIServiceError, ImageGenerationRequest, ImageGenerationResult } from "./types";

export class ImagenService {
  private apiKey: string;
  private endpoint: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(
    apiKey?: string,
    maxRetries: number = 3,
    retryDelayMs: number = 2000
  ) {
    this.apiKey = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    this.endpoint = "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateImages";
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;

    if (!this.apiKey) {
      console.warn(
        "[IMAGEN_SERVICE] API key not configured. Service will use placeholder images."
      );
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate images from prompts
   */
  async generateImages(
    prompts: string[],
    style: string = "realistic"
  ): Promise<ImageGenerationResult[]> {
    if (!this.isConfigured()) {
      return this.getFallbackImages(prompts);
    }

    const allowed = await rateLimiter.checkLimit("imagen");
    if (!allowed) {
      throw this.createError(
        "rate_limit",
        "Image generation rate limit exceeded",
        true,
        rateLimiter.getResetTime("imagen")
      );
    }

    const results: ImageGenerationResult[] = [];

    for (let i = 0; i < prompts.length; i++) {
      try {
        const result = await this.generateSingleImage({
          prompt: this.enhancePrompt(prompts[i], style),
          style,
          aspectRatio: "16:9",
          numberOfImages: 1,
        });

        results.push({
          imageBytes: result,
          prompt: prompts[i],
          index: i,
        });

        await rateLimiter.recordRequest("imagen");
      } catch (error) {
        console.error(`[IMAGEN_SERVICE] Failed to generate image ${i}:`, error);
        // Continue with other images even if one fails
        results.push({
          imageBytes: "",
          prompt: prompts[i],
          index: i,
        });
      }
    }

    return results;
  }

  /**
   * Generate a single image (convenience method)
   */
  async generateImage(
    prompt: string,
    style: string = "realistic",
    aspectRatio: string = "16:9"
  ): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      return {
        imageBytes: "",
        prompt,
        index: 0,
      };
    }

    const allowed = await rateLimiter.checkLimit("imagen");
    if (!allowed) {
      throw this.createError(
        "rate_limit",
        "Image generation rate limit exceeded",
        true,
        rateLimiter.getResetTime("imagen")
      );
    }

    try {
      const imageBytes = await this.generateSingleImage({
        prompt: this.enhancePrompt(prompt, style),
        style,
        aspectRatio,
        numberOfImages: 1,
      });

      await rateLimiter.recordRequest("imagen");

      return {
        imageBytes,
        prompt,
        index: 0,
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate a single image
   */
  private async generateSingleImage(
    request: ImageGenerationRequest
  ): Promise<string> {
    return await this.executeWithRetry(async () => {
      const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: request.prompt,
          config: {
            numberOfImages: request.numberOfImages || 1,
            aspectRatio: request.aspectRatio || "16:9",
            negativePrompt: "blurry, low quality, distorted, watermark",
            safetyFilterLevel: "block_some",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.generatedImages && data.generatedImages.length > 0) {
        return data.generatedImages[0].image.imageBytes;
      }

      throw new Error("No image data received from API");
    });
  }

  /**
   * Enhance prompt with style guidance
   */
  private enhancePrompt(prompt: string, style: string): string {
    const styleGuides: Record<string, string> = {
      realistic: "photorealistic, high detail, natural lighting",
      artistic: "artistic, painterly, expressive, creative interpretation",
      minimalist: "minimalist, clean, simple, elegant composition",
    };

    const styleGuide = styleGuides[style] || styleGuides.realistic;
    return `${prompt}, ${styleGuide}, professional quality`;
  }

  /**
   * Get fallback placeholder images
   */
  private getFallbackImages(prompts: string[]): ImageGenerationResult[] {
    return prompts.map((prompt, index) => ({
      imageBytes: "",
      prompt,
      index,
    }));
  }



  /**
   * Execute function with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 0
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < this.maxRetries && this.isRetryable(error)) {
        const delay = this.retryDelayMs * Math.pow(2, attempt);
        console.log(
          `[IMAGEN_SERVICE] Retry attempt ${attempt + 1}/${
            this.maxRetries
          } after ${delay}ms`
        );
        await this.delay(delay);
        return this.executeWithRetry(fn, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("503") ||
        message.includes("500")
      );
    }
    return false;
  }

  /**
   * Handle and transform errors
   */
  private handleError(error: unknown): AIServiceError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("429") || message.includes("rate limit")) {
        return this.createError("rate_limit", "Rate limit exceeded", true);
      }

      if (message.includes("network") || message.includes("fetch")) {
        return this.createError("network", "Network error occurred", true);
      }

      if (message.includes("timeout")) {
        return this.createError("timeout", "Request timed out", true);
      }

      return this.createError("api_error", error.message, false, undefined, error);
    }

    return this.createError("unknown", "An unknown error occurred", false);
  }

  /**
   * Create standardized error object
   */
  private createError(
    type: AIServiceError["type"],
    message: string,
    retryable: boolean,
    retryAfter?: number,
    originalError?: Error
  ): AIServiceError {
    return {
      type,
      message,
      retryable,
      retryAfter,
      originalError,
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const imagenService = new ImagenService();
