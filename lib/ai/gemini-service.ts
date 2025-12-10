/**
 * Enhanced Google Gemini AI Service
 * Provides content generation, translation, grammar improvement, and more
 * 
 * Includes caching for common operations to reduce API costs and improve response times.
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { rateLimiter } from "./rate-limiter";
import { AIServiceError, GenerationConfig } from "./types";
import { getAIResponseCache } from "../cache/ai-response-cache";

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
      toneGuidance?: string;
      audienceGuidance?: string;
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
    const toneGuidance = config.toneGuidance || "";
    const audienceGuidance = config.audienceGuidance || "";

    try {
      const { text } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `You are a skilled storyteller. Transform the provided raw content into a complete, engaging ${tone} story suitable for ${audience}.

TONE GUIDANCE: ${toneGuidance}

AUDIENCE GUIDANCE: ${audienceGuidance}

IMPORTANT REQUIREMENTS:
1. Target Length: Generate EXACTLY ${numberOfPages} pages worth of content (approximately ${targetWordCount} words). This is critical - the story must be substantial.
2. Story Structure: Create a well-structured narrative with:
   - Engaging introduction that hooks the reader
   - Well-developed middle with proper pacing and tension
   - Satisfying conclusion that provides closure
3. Content Expansion: Expand the raw content into a full narrative by:
   - Adding rich descriptive details and sensory information
   - Developing characters with depth and emotional complexity
   - Creating vivid scenes and immersive settings
   - Building proper story arc with rising action and climax
   - Including dialogue where appropriate
4. Format: Use markdown with:
   - Proper headings (## for chapters/sections)
   - Well-structured paragraphs (not too long)
   - Emphasis using **bold** and *italic* where appropriate
   - Scene breaks using --- where needed
5. Quality: Ensure emotional depth, engaging prose, and natural flow
6. Consistency: Maintain consistent tone, voice, and style throughout

The raw content is just the foundation - transform it into a complete, professional story that fills ${numberOfPages} pages. Do not summarize or shorten - expand and enrich the content.`,
          prompt: `Raw content to transform into a ${numberOfPages}-page ${tone} story for ${audience}:\n\n${content}`,
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
   * Results are cached to avoid redundant API calls
   */
  async improveGrammar(text: string, language: string = "en"): Promise<string> {
    if (!this.isConfigured()) {
      return text;
    }

    // Check cache first
    const cache = getAIResponseCache();
    const cached = await cache.getGrammar(text, language);
    if (cached) {
      console.log("[GEMINI_SERVICE] Grammar improvement served from cache");
      return cached;
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
      
      // Cache the result
      await cache.cacheGrammar(text, language, improved);
      
      return improved;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Rewrite content with different tone
   * Results are cached to avoid redundant API calls
   */
  async rewriteContent(
    text: string,
    tone: string = "casual"
  ): Promise<string> {
    if (!this.isConfigured()) {
      return text;
    }

    // Check cache first
    const cache = getAIResponseCache();
    const cached = await cache.getRewrite(text, tone);
    if (cached) {
      console.log("[GEMINI_SERVICE] Rewrite served from cache");
      return cached;
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
      
      // Cache the result
      await cache.cacheRewrite(text, tone, rewritten);
      
      return rewritten;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Expand content with more details
   * Results are cached to avoid redundant API calls
   */
  async expandContent(text: string, context: string = ""): Promise<string> {
    if (!this.isConfigured()) {
      return text + "\n\n[Additional content would be generated here]";
    }

    // Check cache first
    const cache = getAIResponseCache();
    const cached = await cache.getExpansion(text, context);
    if (cached) {
      console.log("[GEMINI_SERVICE] Expansion served from cache");
      return cached;
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
      
      // Cache the result
      await cache.cacheExpansion(text, context, expanded);
      
      return expanded;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Translate text to target language
   * Results are cached to avoid redundant API calls
   */
  async translateText(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      return `[Translation to ${targetLanguage}]: ${text}`;
    }

    // Check cache first
    const cache = getAIResponseCache();
    const cached = await cache.getTranslation(text, targetLanguage);
    if (cached) {
      console.log("[GEMINI_SERVICE] Translation served from cache");
      return cached;
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
      
      // Cache the result
      await cache.cacheTranslation(text, targetLanguage, translated);
      
      return translated;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate description from story content
   * Results are cached to avoid redundant API calls
   */
  async generateDescription(storyContent: string): Promise<string> {
    if (!this.isConfigured()) {
      return "A compelling story about life, growth, and transformation.";
    }

    // Use truncated content for cache key consistency
    const contentForCache = storyContent.substring(0, 2000);
    
    // Check cache first
    const cache = getAIResponseCache();
    const cached = await cache.getDescription(contentForCache);
    if (cached) {
      console.log("[GEMINI_SERVICE] Description served from cache");
      return cached;
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
          prompt: contentForCache,
        });
      });

      await rateLimiter.recordRequest("gemini");
      
      // Cache the result
      await cache.cacheDescription(contentForCache, description);
      
      return description;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate image prompts from story content
   * Results are cached to avoid redundant API calls
   */
  async generateImagePrompts(
    storyContent: string,
    numberOfImages: number,
    options?: {
      style?: 'realistic' | 'artistic' | 'minimalist';
      targetAudience?: 'children' | 'adults' | 'all';
    }
  ): Promise<string[]> {
    if (!this.isConfigured()) {
      return Array(numberOfImages)
        .fill(0)
        .map((_, i) => `A meaningful scene from the story, image ${i + 1}`);
    }

    const style = options?.style || 'realistic';
    const audience = options?.targetAudience || 'adults';
    
    // Use truncated content for cache key consistency
    const contentForCache = storyContent.substring(0, 4000);
    
    // Check cache first
    const cache = getAIResponseCache();
    const cached = await cache.getImagePrompts(contentForCache, numberOfImages, style);
    if (cached && cached.length >= numberOfImages) {
      console.log("[GEMINI_SERVICE] Image prompts served from cache");
      return cached.slice(0, numberOfImages);
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    const styleGuidance = {
      realistic: 'photorealistic, detailed, natural lighting, cinematic composition',
      artistic: 'artistic, painterly, expressive brushstrokes, creative interpretation',
      minimalist: 'minimalist, clean lines, simple composition, elegant negative space',
    };

    const audienceGuidance = {
      children: 'bright colors, friendly characters, whimsical elements, safe for children',
      adults: 'sophisticated composition, emotional depth, mature themes',
      all: 'universally appealing, family-friendly, emotionally resonant',
    };

    try {
      const { text } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `You are an expert at creating detailed image prompts for AI image generation.

Generate exactly ${numberOfImages} image prompts that capture key moments from the story.

REQUIREMENTS:
1. Each prompt should be on a separate line
2. Each prompt should be 50-100 words
3. Include specific visual details: lighting, composition, colors, mood
4. Style guidance: ${styleGuidance[style]}
5. Audience consideration: ${audienceGuidance[audience]}
6. Avoid text, logos, or watermarks in the prompts
7. Focus on emotional moments and key scenes
8. Include environmental and atmospheric details

FORMAT: Output only the prompts, one per line, no numbering or prefixes.`,
          prompt: `Story content:\n\n${storyContent.substring(0, 4000)}`,
        });
      });

      await rateLimiter.recordRequest("gemini");
      
      // Parse and clean prompts
      const prompts = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 20) // Filter out short/empty lines
        .map((line) => {
          // Remove any numbering prefixes like "1.", "1)", etc.
          return line.replace(/^\d+[\.\)\-\:]\s*/, '').trim();
        })
        .slice(0, numberOfImages);

      // Ensure we have the requested number of prompts
      while (prompts.length < numberOfImages) {
        const fallbackPrompt = this.generateFallbackPrompt(
          storyContent,
          prompts.length,
          style
        );
        prompts.push(fallbackPrompt);
      }

      // Cache the result
      await cache.cacheImagePrompts(contentForCache, numberOfImages, style, prompts);

      return prompts;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Generate a fallback prompt when AI generation fails or returns insufficient prompts
   */
  private generateFallbackPrompt(
    storyContent: string,
    index: number,
    style: string
  ): string {
    const styleDescriptions = {
      realistic: 'photorealistic, cinematic lighting',
      artistic: 'artistic, painterly style',
      minimalist: 'minimalist, clean composition',
    };

    // Extract some context from the story
    const words = storyContent.split(/\s+/).slice(0, 50).join(' ');
    const context = words.length > 100 ? words.substring(0, 100) : words;

    return `A meaningful scene depicting ${context}..., ${styleDescriptions[style as keyof typeof styleDescriptions] || styleDescriptions.realistic}, emotional depth, professional quality, image ${index + 1}`;
  }

  /**
   * Generate image prompts optimized for specific story sections
   */
  async generateSectionImagePrompts(
    sections: { title: string; content: string }[],
    style: string = 'realistic'
  ): Promise<{ section: string; prompt: string }[]> {
    if (!this.isConfigured()) {
      return sections.map((section, i) => ({
        section: section.title,
        prompt: `A scene from ${section.title}, image ${i + 1}`,
      }));
    }

    const allowed = await rateLimiter.checkLimit("gemini");
    if (!allowed) {
      throw this.createError("rate_limit", "Rate limit exceeded", true);
    }

    try {
      const sectionsText = sections
        .map((s) => `Section: ${s.title}\nContent: ${s.content.substring(0, 500)}`)
        .join('\n\n---\n\n');

      const { text } = await this.executeWithRetry(async () => {
        return await generateText({
          model: google(this.model),
          system: `Generate one detailed image prompt for each story section.
Format: SECTION_TITLE: prompt text
Style: ${style}
Each prompt should be 50-100 words with specific visual details.`,
          prompt: sectionsText,
        });
      });

      await rateLimiter.recordRequest("gemini");

      const results: { section: string; prompt: string }[] = [];
      const lines = text.split('\n').filter((l) => l.includes(':'));

      for (let i = 0; i < sections.length; i++) {
        const line = lines[i];
        if (line) {
          const colonIndex = line.indexOf(':');
          const prompt = line.substring(colonIndex + 1).trim();
          results.push({
            section: sections[i].title,
            prompt: prompt || `A scene from ${sections[i].title}`,
          });
        } else {
          results.push({
            section: sections[i].title,
            prompt: `A meaningful scene from ${sections[i].title}, ${style} style`,
          });
        }
      }

      return results;
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
