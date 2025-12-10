/**
 * AI Response Cache
 * 
 * Specialized caching layer for AI service responses.
 * Caches translations, grammar improvements, rewrites, and other AI operations
 * to reduce API costs and improve response times.
 * 
 * Requirements: Performance optimization (Task 32)
 */

import {
  getRedisCache,
  CACHE_TTL,
  CACHE_PREFIX,
  type CacheOptions,
} from "./redis-cache";

export interface AIResponseCacheKey {
  operation: "translation" | "grammar" | "rewrite" | "expand" | "description" | "image_prompts";
  input: string;
  language?: string;
  tone?: string;
  style?: string;
  count?: number;
}

export interface CachedAIResponse<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
  operation: string;
}

/**
 * AI Response Cache Manager
 * Provides caching for common AI operations
 */
export class AIResponseCache {
  private cache = getRedisCache();

  /**
   * Generate cache key for AI operation
   */
  private generateCacheKey(params: AIResponseCacheKey): string {
    const hash = this.cache.generateHash(params.input);
    const parts = [params.operation, hash];

    if (params.language) parts.push(params.language);
    if (params.tone) parts.push(params.tone);
    if (params.style) parts.push(params.style);
    if (params.count) parts.push(params.count.toString());

    return parts.join(":");
  }

  /**
   * Get prefix for operation type
   */
  private getPrefix(operation: AIResponseCacheKey["operation"]): string {
    const prefixMap: Record<AIResponseCacheKey["operation"], string> = {
      translation: CACHE_PREFIX.AI_TRANSLATION,
      grammar: CACHE_PREFIX.AI_GRAMMAR,
      rewrite: CACHE_PREFIX.AI_REWRITE,
      expand: CACHE_PREFIX.AI_EXPAND,
      description: CACHE_PREFIX.AI_DESCRIPTION,
      image_prompts: CACHE_PREFIX.AI_IMAGE_PROMPTS,
    };
    return prefixMap[operation];
  }

  /**
   * Get TTL for operation type
   */
  private getTTL(operation: AIResponseCacheKey["operation"]): number {
    const ttlMap: Record<AIResponseCacheKey["operation"], number> = {
      translation: CACHE_TTL.TRANSLATION,
      grammar: CACHE_TTL.GRAMMAR,
      rewrite: CACHE_TTL.AI_RESPONSE,
      expand: CACHE_TTL.AI_RESPONSE,
      description: CACHE_TTL.DESCRIPTION,
      image_prompts: CACHE_TTL.IMAGE_PROMPTS,
    };
    return ttlMap[operation];
  }

  /**
   * Get cached AI response
   */
  async get<T>(params: AIResponseCacheKey): Promise<T | null> {
    const key = this.generateCacheKey(params);
    const options: CacheOptions = {
      prefix: this.getPrefix(params.operation),
    };

    const cached = await this.cache.get<CachedAIResponse<T>>(key, options);
    
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`[AI_CACHE] Hit for ${params.operation}:`, key.substring(0, 30));
      return cached.data;
    }

    return null;
  }

  /**
   * Set cached AI response
   */
  async set<T>(params: AIResponseCacheKey, data: T): Promise<boolean> {
    const key = this.generateCacheKey(params);
    const ttl = this.getTTL(params.operation);
    const now = Date.now();

    const cached: CachedAIResponse<T> = {
      data,
      cachedAt: now,
      expiresAt: now + ttl * 1000,
      operation: params.operation,
    };

    const options: CacheOptions = {
      prefix: this.getPrefix(params.operation),
      ttl,
    };

    const success = await this.cache.set(key, cached, options);
    
    if (success) {
      console.log(`[AI_CACHE] Cached ${params.operation}:`, key.substring(0, 30));
    }

    return success;
  }

  /**
   * Get or fetch AI response with caching
   */
  async getOrFetch<T>(
    params: AIResponseCacheKey,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(params);
    if (cached !== null) {
      return cached;
    }

    // Fetch from AI service
    const result = await fetchFn();

    // Cache the result (don't await to avoid blocking)
    this.set(params, result).catch((error) => {
      console.error("[AI_CACHE] Failed to cache result:", error);
    });

    return result;
  }

  /**
   * Cache translation result
   */
  async cacheTranslation(
    text: string,
    targetLanguage: string,
    translation: string
  ): Promise<boolean> {
    return this.set(
      { operation: "translation", input: text, language: targetLanguage },
      translation
    );
  }

  /**
   * Get cached translation
   */
  async getTranslation(
    text: string,
    targetLanguage: string
  ): Promise<string | null> {
    return this.get<string>({
      operation: "translation",
      input: text,
      language: targetLanguage,
    });
  }

  /**
   * Cache grammar improvement result
   */
  async cacheGrammar(
    text: string,
    language: string,
    improved: string
  ): Promise<boolean> {
    return this.set(
      { operation: "grammar", input: text, language },
      improved
    );
  }

  /**
   * Get cached grammar improvement
   */
  async getGrammar(text: string, language: string): Promise<string | null> {
    return this.get<string>({
      operation: "grammar",
      input: text,
      language,
    });
  }

  /**
   * Cache rewrite result
   */
  async cacheRewrite(
    text: string,
    tone: string,
    rewritten: string
  ): Promise<boolean> {
    return this.set(
      { operation: "rewrite", input: text, tone },
      rewritten
    );
  }

  /**
   * Get cached rewrite
   */
  async getRewrite(text: string, tone: string): Promise<string | null> {
    return this.get<string>({
      operation: "rewrite",
      input: text,
      tone,
    });
  }

  /**
   * Cache content expansion result
   */
  async cacheExpansion(
    text: string,
    context: string,
    expanded: string
  ): Promise<boolean> {
    const combinedInput = `${text}|||${context}`;
    return this.set(
      { operation: "expand", input: combinedInput },
      expanded
    );
  }

  /**
   * Get cached content expansion
   */
  async getExpansion(text: string, context: string): Promise<string | null> {
    const combinedInput = `${text}|||${context}`;
    return this.get<string>({
      operation: "expand",
      input: combinedInput,
    });
  }

  /**
   * Cache description generation result
   */
  async cacheDescription(
    storyContent: string,
    description: string
  ): Promise<boolean> {
    return this.set(
      { operation: "description", input: storyContent },
      description
    );
  }

  /**
   * Get cached description
   */
  async getDescription(storyContent: string): Promise<string | null> {
    return this.get<string>({
      operation: "description",
      input: storyContent,
    });
  }

  /**
   * Cache image prompts result
   */
  async cacheImagePrompts(
    storyContent: string,
    numberOfImages: number,
    style: string,
    prompts: string[]
  ): Promise<boolean> {
    return this.set(
      {
        operation: "image_prompts",
        input: storyContent,
        count: numberOfImages,
        style,
      },
      prompts
    );
  }

  /**
   * Get cached image prompts
   */
  async getImagePrompts(
    storyContent: string,
    numberOfImages: number,
    style: string
  ): Promise<string[] | null> {
    return this.get<string[]>({
      operation: "image_prompts",
      input: storyContent,
      count: numberOfImages,
      style,
    });
  }

  /**
   * Invalidate cache for specific operation
   */
  async invalidate(operation: AIResponseCacheKey["operation"]): Promise<number> {
    const prefix = this.getPrefix(operation);
    return this.cache.deleteByPattern(`${prefix}*`);
  }

  /**
   * Invalidate all AI caches
   */
  async invalidateAll(): Promise<void> {
    const operations: AIResponseCacheKey["operation"][] = [
      "translation",
      "grammar",
      "rewrite",
      "expand",
      "description",
      "image_prompts",
    ];

    for (const operation of operations) {
      await this.invalidate(operation);
    }

    console.log("[AI_CACHE] All AI caches invalidated");
  }
}

// Singleton instance
let aiResponseCacheInstance: AIResponseCache | null = null;

/**
 * Get AI response cache instance
 */
export function getAIResponseCache(): AIResponseCache {
  if (!aiResponseCacheInstance) {
    aiResponseCacheInstance = new AIResponseCache();
  }
  return aiResponseCacheInstance;
}
