/**
 * Audio Streaming Module Tests
 * 
 * Tests for audio streaming optimization functionality including:
 * - Range request support
 * - Chapter preloading
 * - Quality level management
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AudioStreamingService,
  AudioStreamingConfig,
  AUDIO_QUALITY_LEVELS,
} from "../audio-streaming";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AudioStreamingService", () => {
  let service: AudioStreamingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AudioStreamingService({
      preloadAhead: 2,
      enableRangeRequests: true,
    });
  });

  afterEach(() => {
    service.dispose();
  });

  describe("initialization", () => {
    it("should initialize with default config", () => {
      const defaultService = new AudioStreamingService();
      const stats = defaultService.getStats();
      
      expect(stats.totalBytesLoaded).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      
      defaultService.dispose();
    });

    it("should initialize with custom config", () => {
      const customService = new AudioStreamingService({
        preloadAhead: 5,
        enableAdaptiveBitrate: true,
        targetBitrate: 192,
      });
      
      expect(customService).toBeDefined();
      customService.dispose();
    });
  });

  describe("fetchWithRange", () => {
    it("should fetch audio without range header when not specified", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers({
          "Content-Length": "1000",
        }),
      });

      const result = await service.fetchWithRange("https://example.com/audio.wav");

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/audio.wav", {
        headers: {},
      });
      expect(result.data.byteLength).toBe(1000);
      expect(result.isComplete).toBe(true);
    });

    it("should fetch audio with range header when specified", async () => {
      const mockData = new ArrayBuffer(500);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 206,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers({
          "Content-Range": "bytes 0-499/1000",
          "Content-Length": "500",
        }),
      });

      const result = await service.fetchWithRange(
        "https://example.com/audio.wav",
        0,
        499
      );

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/audio.wav", {
        headers: { Range: "bytes=0-499" },
      });
      expect(result.start).toBe(0);
      expect(result.end).toBe(499);
      expect(result.total).toBe(1000);
      expect(result.isComplete).toBe(false);
    });

    it("should update statistics after fetch", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      await service.fetchWithRange("https://example.com/audio.wav");

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalBytesLoaded).toBe(1000);
    });

    it("should throw error on failed fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        service.fetchWithRange("https://example.com/audio.wav")
      ).rejects.toThrow("HTTP error! status: 404");
    });
  });

  describe("chapter preloading", () => {
    const chapterUrls = [
      "https://example.com/chapter0.wav",
      "https://example.com/chapter1.wav",
      "https://example.com/chapter2.wav",
      "https://example.com/chapter3.wav",
    ];

    it("should preload chapters ahead of current position", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      await service.preloadChapters(chapterUrls, 0);

      // Wait for preloading to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have preloaded chapters 1 and 2 (preloadAhead = 2)
      expect(service.isChapterPreloaded(1)).toBe(true);
      expect(service.isChapterPreloaded(2)).toBe(true);
      expect(service.isChapterPreloaded(3)).toBe(false);
    });

    it("should return preloaded chapter data", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      await service.preloadChapters(chapterUrls, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const preloadedData = service.getPreloadedChapter(1);
      expect(preloadedData).not.toBeNull();
      expect(preloadedData?.byteLength).toBe(1000);
    });

    it("should return null for non-preloaded chapters", () => {
      const data = service.getPreloadedChapter(0);
      expect(data).toBeNull();
    });

    it("should track cache hits and misses", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      await service.preloadChapters(chapterUrls, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cache hit
      service.getPreloadedChapter(1);
      expect(service.getStats().cacheHits).toBe(1);

      // Cache miss
      service.getPreloadedChapter(3);
      expect(service.getStats().cacheMisses).toBe(1);
    });
  });

  describe("preload management", () => {
    it("should cancel pending preloads", async () => {
      const chapterUrls = [
        "https://example.com/chapter0.wav",
        "https://example.com/chapter1.wav",
      ];

      // Slow fetch
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000)),
                  headers: new Headers(),
                }),
              1000
            )
          )
      );

      service.preloadChapters(chapterUrls, 0);
      service.cancelPreloads();

      // Should not have preloaded anything
      expect(service.isChapterPreloaded(1)).toBe(false);
    });

    it("should clear preloaded chapters", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      const chapterUrls = [
        "https://example.com/chapter0.wav",
        "https://example.com/chapter1.wav",
      ];

      await service.preloadChapters(chapterUrls, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(service.isChapterPreloaded(1)).toBe(true);

      service.clearPreloadedChapters();

      expect(service.isChapterPreloaded(1)).toBe(false);
    });
  });

  describe("quality level management", () => {
    it("should return default quality level", () => {
      const quality = service.getOptimalQualityLevel();
      expect(quality).toBeDefined();
      expect(quality.bitrate).toBeGreaterThan(0);
    });

    it("should set quality level manually", () => {
      service.setQualityLevel(0); // Low quality
      const stats = service.getStats();
      expect(stats.currentBitrate).toBe(AUDIO_QUALITY_LEVELS[0].bitrate);
    });

    it("should have all quality levels defined", () => {
      expect(AUDIO_QUALITY_LEVELS.length).toBeGreaterThan(0);
      
      for (const level of AUDIO_QUALITY_LEVELS) {
        expect(level.bitrate).toBeGreaterThan(0);
        expect(level.label).toBeDefined();
        expect(level.suffix).toBeDefined();
      }
    });
  });

  describe("statistics", () => {
    it("should track statistics correctly", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      await service.fetchWithRange("https://example.com/audio1.wav");
      await service.fetchWithRange("https://example.com/audio2.wav");

      const stats = service.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.totalBytesLoaded).toBe(2000);
    });

    it("should reset statistics", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      await service.fetchWithRange("https://example.com/audio.wav");
      
      service.resetStats();
      
      const stats = service.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalBytesLoaded).toBe(0);
    });

    it("should calculate average load time", async () => {
      const mockData = new ArrayBuffer(1000);
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(mockData),
        headers: new Headers(),
      });

      await service.fetchWithRange("https://example.com/audio.wav");

      const stats = service.getStats();
      expect(stats.averageLoadTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("disposal", () => {
    it("should clean up resources on dispose", () => {
      service.dispose();
      
      const stats = service.getStats();
      expect(stats.preloadedChapters).toBe(0);
    });
  });
});
