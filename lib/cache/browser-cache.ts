/**
 * Browser Cache Utilities
 * 
 * Provides client-side caching strategies using:
 * - localStorage for small data (drafts, preferences)
 * - sessionStorage for session-specific data
 * - Cache API for network responses
 * 
 * Requirements: Performance optimization (Task 32)
 */

// Cache keys for localStorage
export const STORAGE_KEYS = {
  DRAFT_PREFIX: "draft:",
  PREFERENCES: "user_preferences",
  PLAYBACK_POSITION: "playback_position:",
  LANGUAGE_PREFERENCE: "language_preference",
  THEME_PREFERENCE: "theme_preference",
  RECENT_STORIES: "recent_stories",
  STAGE_TEMPLATES: "stage_templates:",
} as const;

// Cache expiry times (in milliseconds)
export const BROWSER_CACHE_TTL = {
  DRAFT: 7 * 24 * 60 * 60 * 1000, // 7 days
  PREFERENCES: 30 * 24 * 60 * 60 * 1000, // 30 days
  PLAYBACK: 30 * 24 * 60 * 60 * 1000, // 30 days
  RECENT_STORIES: 24 * 60 * 60 * 1000, // 24 hours
  STAGE_TEMPLATES: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

interface CachedItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/**
 * Browser Cache Manager
 * Handles localStorage and sessionStorage operations
 */
export class BrowserCacheManager {
  /**
   * Get item from localStorage with expiry check
   */
  get<T>(key: string): T | null {
    if (!isBrowser()) return null;

    try {
      const item = localStorage.getItem(key);
      if (!item) return null;

      const cached: CachedItem<T> = JSON.parse(item);
      
      // Check if expired
      if (Date.now() > cached.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.error("[BROWSER_CACHE] Get error:", error);
      return null;
    }
  }

  /**
   * Set item in localStorage with TTL
   */
  set<T>(key: string, data: T, ttlMs: number): boolean {
    if (!isBrowser()) return false;

    try {
      const now = Date.now();
      const cached: CachedItem<T> = {
        data,
        timestamp: now,
        expiresAt: now + ttlMs,
      };

      localStorage.setItem(key, JSON.stringify(cached));
      return true;
    } catch (error) {
      console.error("[BROWSER_CACHE] Set error:", error);
      // Handle quota exceeded
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        this.clearExpired();
        // Retry once after clearing
        try {
          const now = Date.now();
          const cached: CachedItem<T> = {
            data,
            timestamp: now,
            expiresAt: now + ttlMs,
          };
          localStorage.setItem(key, JSON.stringify(cached));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Remove item from localStorage
   */
  remove(key: string): boolean {
    if (!isBrowser()) return false;

    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error("[BROWSER_CACHE] Remove error:", error);
      return false;
    }
  }

  /**
   * Clear all expired items
   */
  clearExpired(): number {
    if (!isBrowser()) return 0;

    let cleared = 0;
    const now = Date.now();

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key) continue;

        try {
          const item = localStorage.getItem(key);
          if (!item) continue;

          const cached = JSON.parse(item);
          if (cached.expiresAt && now > cached.expiresAt) {
            localStorage.removeItem(key);
            cleared++;
          }
        } catch {
          // Skip items that aren't our cached format
        }
      }
    } catch (error) {
      console.error("[BROWSER_CACHE] Clear expired error:", error);
    }

    return cleared;
  }

  /**
   * Clear items by prefix
   */
  clearByPrefix(prefix: string): number {
    if (!isBrowser()) return 0;

    let cleared = 0;

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          localStorage.removeItem(key);
          cleared++;
        }
      }
    } catch (error) {
      console.error("[BROWSER_CACHE] Clear by prefix error:", error);
    }

    return cleared;
  }

  /**
   * Get storage usage info
   */
  getStorageInfo(): { used: number; available: number; percentage: number } {
    if (!isBrowser()) {
      return { used: 0, available: 0, percentage: 0 };
    }

    try {
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value) {
            used += key.length + value.length;
          }
        }
      }

      // Estimate available (typically 5-10MB)
      const available = 5 * 1024 * 1024; // 5MB estimate
      const percentage = (used / available) * 100;

      return { used, available, percentage };
    } catch (error) {
      return { used: 0, available: 0, percentage: 0 };
    }
  }
}

// Singleton instance
let browserCacheInstance: BrowserCacheManager | null = null;

/**
 * Get browser cache instance
 */
export function getBrowserCache(): BrowserCacheManager {
  if (!browserCacheInstance) {
    browserCacheInstance = new BrowserCacheManager();
  }
  return browserCacheInstance;
}

/**
 * Draft Storage Utilities
 */
export const draftStorage = {
  /**
   * Save story draft
   */
  saveDraft(storyId: string, content: string): boolean {
    const cache = getBrowserCache();
    return cache.set(
      `${STORAGE_KEYS.DRAFT_PREFIX}${storyId}`,
      content,
      BROWSER_CACHE_TTL.DRAFT
    );
  },

  /**
   * Get story draft
   */
  getDraft(storyId: string): string | null {
    const cache = getBrowserCache();
    return cache.get<string>(`${STORAGE_KEYS.DRAFT_PREFIX}${storyId}`);
  },

  /**
   * Remove story draft
   */
  removeDraft(storyId: string): boolean {
    const cache = getBrowserCache();
    return cache.remove(`${STORAGE_KEYS.DRAFT_PREFIX}${storyId}`);
  },

  /**
   * Clear all drafts
   */
  clearAllDrafts(): number {
    const cache = getBrowserCache();
    return cache.clearByPrefix(STORAGE_KEYS.DRAFT_PREFIX);
  },
};

/**
 * Playback Position Storage
 */
export const playbackStorage = {
  /**
   * Save playback position
   */
  savePosition(
    storyId: string,
    chapterIndex: number,
    position: number
  ): boolean {
    const cache = getBrowserCache();
    return cache.set(
      `${STORAGE_KEYS.PLAYBACK_POSITION}${storyId}`,
      { chapterIndex, position },
      BROWSER_CACHE_TTL.PLAYBACK
    );
  },

  /**
   * Get playback position
   */
  getPosition(
    storyId: string
  ): { chapterIndex: number; position: number } | null {
    const cache = getBrowserCache();
    return cache.get<{ chapterIndex: number; position: number }>(
      `${STORAGE_KEYS.PLAYBACK_POSITION}${storyId}`
    );
  },

  /**
   * Clear playback position
   */
  clearPosition(storyId: string): boolean {
    const cache = getBrowserCache();
    return cache.remove(`${STORAGE_KEYS.PLAYBACK_POSITION}${storyId}`);
  },
};

/**
 * User Preferences Storage
 */
export const preferencesStorage = {
  /**
   * Save user preferences
   */
  savePreferences(preferences: Record<string, unknown>): boolean {
    const cache = getBrowserCache();
    return cache.set(
      STORAGE_KEYS.PREFERENCES,
      preferences,
      BROWSER_CACHE_TTL.PREFERENCES
    );
  },

  /**
   * Get user preferences
   */
  getPreferences(): Record<string, unknown> | null {
    const cache = getBrowserCache();
    return cache.get<Record<string, unknown>>(STORAGE_KEYS.PREFERENCES);
  },

  /**
   * Save language preference
   */
  saveLanguage(language: string): boolean {
    const cache = getBrowserCache();
    return cache.set(
      STORAGE_KEYS.LANGUAGE_PREFERENCE,
      language,
      BROWSER_CACHE_TTL.PREFERENCES
    );
  },

  /**
   * Get language preference
   */
  getLanguage(): string | null {
    const cache = getBrowserCache();
    return cache.get<string>(STORAGE_KEYS.LANGUAGE_PREFERENCE);
  },
};

/**
 * Recent Stories Storage
 */
export const recentStoriesStorage = {
  /**
   * Add story to recent list
   */
  addRecent(storyId: string, title: string): boolean {
    const cache = getBrowserCache();
    const recent = cache.get<Array<{ id: string; title: string; viewedAt: number }>>(
      STORAGE_KEYS.RECENT_STORIES
    ) || [];

    // Remove if already exists
    const filtered = recent.filter((s) => s.id !== storyId);

    // Add to front
    filtered.unshift({ id: storyId, title, viewedAt: Date.now() });

    // Keep only last 20
    const trimmed = filtered.slice(0, 20);

    return cache.set(
      STORAGE_KEYS.RECENT_STORIES,
      trimmed,
      BROWSER_CACHE_TTL.RECENT_STORIES
    );
  },

  /**
   * Get recent stories
   */
  getRecent(): Array<{ id: string; title: string; viewedAt: number }> {
    const cache = getBrowserCache();
    return cache.get<Array<{ id: string; title: string; viewedAt: number }>>(
      STORAGE_KEYS.RECENT_STORIES
    ) || [];
  },

  /**
   * Clear recent stories
   */
  clearRecent(): boolean {
    const cache = getBrowserCache();
    return cache.remove(STORAGE_KEYS.RECENT_STORIES);
  },
};
