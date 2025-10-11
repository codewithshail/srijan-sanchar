/**
 * Enhanced Google Gemini AI Service
 * Provides content generation, translation, grammar improvement, and more
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { rateLimiter } from "./rate-limiter";
import { AIServiceError, GenerationConfig } from "./types";

interface LifeStage {
  stageName: string;
  content: string;
}

export class GeminiService {
  private apiKey: string;
  private model: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(
    apiKey?: string,
    model: string = "gemini-2.0-flash",
    maxRetries: number = 3,
    retryDelayMs: number = 1000
  ) {
    this.apiKey = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    this.model = model;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;

    if (!this.apiKey) {
      console.warn(
        "[GEMINI_SERVICE] API key not configured. Service will use fallback responses."
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
   * Generate complete story from life stages
   */
  async generateStoryFromStages(
    stages: LifeStage[],
    config: GenerationConfig
  ): Promise<string> {
    if (!this.isConfigured()) {
      return this.getFallbackStory(stages);
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError(
        "rate_limit",
        "Rate limit exceeded. Please try again later.",
        true,
        rateLimiter.getResetTime("gemini")
      );
    }

    const prompt = this.buildStoryPrompt(stages, config);

    try {
      const { text } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: this.getStoryGenerationSystemPrompt(config),
          prompt,
        });
      });

      await rateLimiter.recordRequest("gemini");
      return text;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate complete story from raw content
   */
  async generateStoryFromContent(
    content: string,
    config: {
      tone?: string;
      targetAudience?: string;
      numberOfPages?: number;
      targetWordCount?: number;
    }
  ): Promise<string> {
    if (!this.isConfigured()) {
      return content + "\n\n*Configure Gemini API for enhanced generation.*";
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError(
        "rate_limit",
        "Rate limit exceeded. Please try again later.",
        true,
        rateLimiter.getResetTime("gemini")
      );
    }

    const tone = config.tone || "narrative";
    const audience = config.targetAudience || "adults";
    const numberOfPages = config.numberOfPages || 12;
    const targetWordCount = config.targetWordCount || numberOfPages * 250;

    try {
      const { text } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `You are a skilled storyteller. Transform the provided raw content into a complete, engaging ${tone} story suitable for ${audience}.

IMPORTANT REQUIREMENTS:
1. Target Length: Generate EXACTLY ${numberOfPages} pages worth of content (approximately ${targetWordCount} words)
2. Story Structure: Create a well-structured narrative with:
   - Engaging introduction
   - Well-developed middle with proper pacing
   - Satisfying conclusion
3. Content Expansion: Expand the raw content into a full narrative by:
   - Adding descriptive details and sensory information
   - Developing characters and their emotions
   - Creating vivid scenes and settings
   - Building proper story arc and tension
4. Format: Use markdown with proper headings (##), paragraphs, and emphasis (bold/italic)
5. Quality: Ensure emotional depth, engaging prose, and natural flow

The raw content is just the foundation - transform it into a complete, professional story that fills ${numberOfPages} pages.`,
          prompt: `Raw content to transform into a ${numberOfPages}-page story:\n\n${content}`,
        });
      });

      await rateLimiter.recordRequest("gemini");
      return text;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Improve grammar of text
   */
  async improveGrammar(text: string, language: string = "en"): Promise<string> {
    if (!this.isConfigured()) {
      return text;
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    try {
      const { text: improved } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `You are a grammar expert. Improve the grammar and clarity of the text while preserving its meaning and tone. Language: ${language}`,
          prompt: text,
        });
      });

      await rateLimiter.recordRequest("gemini");
      return improved;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Rewrite content with different tone
   */
  async rewriteContent(
    text: string,
    tone: string = "casual"
  ): Promise<string> {
    if (!this.isConfigured()) {
      return text;
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    try {
      const { text: rewritten } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `Rewrite the text in a ${tone} tone while preserving the core message and meaning.`,
          prompt: text,
        });
      });

      await rateLimiter.recordRequest("gemini");
      return rewritten;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Expand content with more details
   */
  async expandContent(text: string, context: string = ""): Promise<string> {
    if (!this.isConfigured()) {
      return text + "\n\n[Additional content would be generated here]";
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    try {
      const { text: expanded } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `Expand the given text with more details, examples, and depth. Context: ${context}`,
          prompt: text,
        });
      });

      await rateLimiter.recordRequest("gemini");
      return expanded;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Translate text to target language
   */
  async translateText(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      return `[Translation to ${targetLanguage}]: ${text}`;
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    try {
      const { text: translated } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `Translate the text to ${targetLanguage} while preserving meaning, tone, and cultural context.`,
          prompt: text,
        });
      });

      await rateLimiter.recordRequest("gemini");
      return translated;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate description from story content
   */
  async generateDescription(storyContent: string): Promise<string> {
    if (!this.isConfigured()) {
      return "A compelling story about life, growth, and transformation.";
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    try {
      const { text: description } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: "Generate a compelling 2-3 sentence description for this story.",
          prompt: storyContent.substring(0, 2000),
        });
      });

      await rateLimiter.recordRequest("gemini");
      return description;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate image prompts from story content
   */
  async generateImagePrompts(
    storyContent: string,
    numberOfImages: number
  ): Promise<string[]> {
    if (!this.isConfigured()) {
      return Array(numberOfImages)
        .fill(0)
        .map((_, i) => `A meaningful scene from the story, image ${i + 1}`);
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    try {
      const { text } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `Generate ${numberOfImages} detailed image prompts for illustrations. Each prompt should be on a new line and describe a key scene or moment.`,
          prompt: storyContent,
        });
      });

      await rateLimiter.recordRequest("gemini");
      
      const prompts = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, numberOfImages);

      // Ensure we have the requested number of prompts
      while (prompts.length < numberOfImages) {
        prompts.push(`A meaningful scene from the story, image ${prompts.length + 1}`);
      }

      return prompts;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Build story generation prompt
   */
  private buildStoryPrompt(
    stages: LifeStage[],
    config: GenerationConfig
  ): string {
    const stageContents = stages
      .map((stage) => `${stage.stageName}: ${stage.content}`)
      .join("\n\n");

    const pageGuidance = config.numberOfPages
      ? `Target length: approximately ${config.numberOfPages} pages (about ${
          config.numberOfPages * 250
        } words).`
      : "";

    return `Create a cohesive, engaging story from these life stages:\n\n${stageContents}\n\n${pageGuidance}`;
  }

  /**
   * Get system prompt for story generation
   */
  private getStoryGenerationSystemPrompt(config: GenerationConfig): string {
    const tone = config.tone || "narrative";
    const audience = config.targetAudience || "adults";

    return `You are a skilled storyteller. Create a ${tone} story suitable for ${audience}. 
    Weave the provided life stages into a cohesive narrative with proper structure, 
    emotional depth, and engaging prose. Format the output in markdown with proper headings 
    and paragraphs.`;
  }

  /**
   * Get fallback story when API is not configured
   */
  private getFallbackStory(stages: LifeStage[]): string {
    return stages
      .map(
        (stage, i) =>
          `## ${stage.stageName}\n\n${stage.content}\n\n`
      )
      .join("") + "\n\n*This is a basic story format. Configure Gemini API for enhanced generation.*";
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
          `[GEMINI_SERVICE] Retry attempt ${attempt + 1}/${
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
        message.includes("429")
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
export const geminiService = new GeminiService();
