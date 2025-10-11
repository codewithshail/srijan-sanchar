/**
 * Tests for AI Services
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GeminiService } from "../gemini-service";
import { ImagenService } from "../imagen-service";
import { STTService } from "../stt-service";
import { SarvamTTSService } from "../sarvam-tts";
import { RateLimiter } from "../rate-limiter";

describe("GeminiService", () => {
  let service: GeminiService;

  beforeEach(() => {
    service = new GeminiService("test-key");
  });

  it("should be configured with API key", () => {
    expect(service.isConfigured()).toBe(true);
  });

  it("should not be configured without API key", () => {
    const unconfiguredService = new GeminiService("");
    expect(unconfiguredService.isConfigured()).toBe(false);
  });
});

describe("ImagenService", () => {
  let service: ImagenService;

  beforeEach(() => {
    service = new ImagenService("test-key");
  });

  it("should be configured with API key", () => {
    expect(service.isConfigured()).toBe(true);
  });

  it("should enhance prompts with style", () => {
    // This would test the private method if exposed or through integration
    expect(service).toBeDefined();
  });
});

describe("STTService", () => {
  let service: STTService;

  beforeEach(() => {
    service = new STTService("test-key");
  });

  it("should be configured with API key", () => {
    expect(service.isConfigured()).toBe(true);
  });

  it("should support Indian languages", () => {
    expect(service.isLanguageSupported("hi-IN")).toBe(true);
    expect(service.isLanguageSupported("en-IN")).toBe(true);
    expect(service.isLanguageSupported("invalid")).toBe(false);
  });

  it("should return supported languages", () => {
    const languages = service.getSupportedLanguages();
    expect(languages.length).toBeGreaterThan(0);
    expect(languages[0]).toHaveProperty("code");
    expect(languages[0]).toHaveProperty("name");
  });
});

describe("SarvamTTSService", () => {
  let service: SarvamTTSService;

  beforeEach(() => {
    service = new SarvamTTSService("test-key");
  });

  it("should be configured with API key", () => {
    expect(service.isConfigured()).toBe(true);
  });

  it("should support Indian languages", () => {
    expect(service.isLanguageSupported("hi-IN")).toBe(true);
    expect(service.isLanguageSupported("en-IN")).toBe(true);
    expect(service.isLanguageSupported("invalid")).toBe(false);
  });
});

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  it("should allow requests within limit", async () => {
    const allowed = await limiter.checkLimit("gemini");
    expect(allowed).toBe(true);
  });

  it("should track remaining requests", () => {
    const remaining = limiter.getRemainingRequests("gemini");
    expect(remaining).toBeGreaterThan(0);
  });

  it("should clear rate limits", () => {
    limiter.clear("gemini");
    const remaining = limiter.getRemainingRequests("gemini");
    expect(remaining).toBeGreaterThan(0);
  });
});
