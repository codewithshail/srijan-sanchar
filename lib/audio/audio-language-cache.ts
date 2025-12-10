/**
 * Audio Language Cache
 * 
 * Provides IndexedDB-based caching for audio chapters per language.
 * This enables offline playback and faster language switching.
 * 
 * Requirements: 8.5, 10.4
 */

export interface CachedAudioChapter {
  storyId: string;
  chapterIndex: number;
  language: string;
  audioBlob: Blob;
  duration: number;
  cachedAt: number;
}

export interface AudioCacheMetadata {
  storyId: string;
  language: string;
  totalChapters: number;
  totalDuration: number;
  cachedAt: number;
  expiresAt: number;
}

const DB_NAME = "storyweave-audio-cache";
const DB_VERSION = 1;
const CHAPTERS_STORE = "audio-chapters";
const METADATA_STORE = "cache-metadata";

// Cache expiry: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Audio Language Cache Manager
 * Uses IndexedDB for persistent client-side caching of audio chapters
 */
export class AudioLanguageCache {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === "undefined" || !window.indexedDB) {
        reject(new Error("IndexedDB not available"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("[AUDIO_CACHE] Failed to open database:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("[AUDIO_CACHE] Database opened successfully");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create chapters store with composite key
        if (!db.objectStoreNames.contains(CHAPTERS_STORE)) {
          const chaptersStore = db.createObjectStore(CHAPTERS_STORE, {
            keyPath: ["storyId", "chapterIndex", "language"],
          });
          chaptersStore.createIndex("storyId", "storyId", { unique: false });
          chaptersStore.createIndex("language", "language", { unique: false });
          chaptersStore.createIndex("storyLanguage", ["storyId", "language"], {
            unique: false,
          });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metadataStore = db.createObjectStore(METADATA_STORE, {
            keyPath: ["storyId", "language"],
          });
          metadataStore.createIndex("storyId", "storyId", { unique: false });
          metadataStore.createIndex("expiresAt", "expiresAt", { unique: false });
        }

        console.log("[AUDIO_CACHE] Database schema created/upgraded");
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if audio chapters are cached for a story and language
   */
  async hasCachedAudio(storyId: string, language: string): Promise<boolean> {
    try {
      const db = await this.initDB();
      const metadata = await this.getMetadata(storyId, language);
      
      if (!metadata) return false;
      
      // Check if cache has expired
      if (Date.now() > metadata.expiresAt) {
        await this.clearCache(storyId, language);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("[AUDIO_CACHE] Error checking cache:", error);
      return false;
    }
  }

  /**
   * Get cached audio chapter
   */
  async getCachedChapter(
    storyId: string,
    chapterIndex: number,
    language: string
  ): Promise<CachedAudioChapter | null> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAPTERS_STORE, "readonly");
        const store = transaction.objectStore(CHAPTERS_STORE);
        const request = store.get([storyId, chapterIndex, language]);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          console.error("[AUDIO_CACHE] Error getting chapter:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error getting cached chapter:", error);
      return null;
    }
  }

  /**
   * Get all cached chapters for a story and language
   */
  async getCachedChapters(
    storyId: string,
    language: string
  ): Promise<CachedAudioChapter[]> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAPTERS_STORE, "readonly");
        const store = transaction.objectStore(CHAPTERS_STORE);
        const index = store.index("storyLanguage");
        const request = index.getAll([storyId, language]);

        request.onsuccess = () => {
          const chapters = request.result || [];
          // Sort by chapter index
          chapters.sort((a, b) => a.chapterIndex - b.chapterIndex);
          resolve(chapters);
        };

        request.onerror = () => {
          console.error("[AUDIO_CACHE] Error getting chapters:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error getting cached chapters:", error);
      return [];
    }
  }

  /**
   * Cache an audio chapter
   */
  async cacheChapter(chapter: CachedAudioChapter): Promise<void> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAPTERS_STORE, "readwrite");
        const store = transaction.objectStore(CHAPTERS_STORE);
        const request = store.put(chapter);

        request.onsuccess = () => {
          console.log(
            `[AUDIO_CACHE] Cached chapter ${chapter.chapterIndex} for ${chapter.language}`
          );
          resolve();
        };

        request.onerror = () => {
          console.error("[AUDIO_CACHE] Error caching chapter:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error caching chapter:", error);
    }
  }

  /**
   * Cache multiple chapters and update metadata
   */
  async cacheChapters(
    storyId: string,
    language: string,
    chapters: Array<{
      chapterIndex: number;
      audioBlob: Blob;
      duration: number;
    }>
  ): Promise<void> {
    try {
      const db = await this.initDB();
      const now = Date.now();

      // Cache all chapters
      const transaction = db.transaction(
        [CHAPTERS_STORE, METADATA_STORE],
        "readwrite"
      );
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);

      // Add chapters
      for (const chapter of chapters) {
        const cachedChapter: CachedAudioChapter = {
          storyId,
          chapterIndex: chapter.chapterIndex,
          language,
          audioBlob: chapter.audioBlob,
          duration: chapter.duration,
          cachedAt: now,
        };
        chaptersStore.put(cachedChapter);
      }

      // Update metadata
      const totalDuration = chapters.reduce((sum, ch) => sum + ch.duration, 0);
      const metadata: AudioCacheMetadata = {
        storyId,
        language,
        totalChapters: chapters.length,
        totalDuration,
        cachedAt: now,
        expiresAt: now + CACHE_TTL_MS,
      };
      metadataStore.put(metadata);

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(
            `[AUDIO_CACHE] Cached ${chapters.length} chapters for ${language}`
          );
          resolve();
        };

        transaction.onerror = () => {
          console.error("[AUDIO_CACHE] Error caching chapters:", transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error caching chapters:", error);
    }
  }

  /**
   * Get cache metadata for a story and language
   */
  private async getMetadata(
    storyId: string,
    language: string
  ): Promise<AudioCacheMetadata | null> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(METADATA_STORE, "readonly");
        const store = transaction.objectStore(METADATA_STORE);
        const request = store.get([storyId, language]);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      return null;
    }
  }

  /**
   * Get all cached languages for a story
   */
  async getCachedLanguages(storyId: string): Promise<string[]> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(METADATA_STORE, "readonly");
        const store = transaction.objectStore(METADATA_STORE);
        const index = store.index("storyId");
        const request = index.getAll(storyId);

        request.onsuccess = () => {
          const metadata = request.result || [];
          const now = Date.now();
          // Filter out expired caches
          const validLanguages = metadata
            .filter((m: AudioCacheMetadata) => m.expiresAt > now)
            .map((m: AudioCacheMetadata) => m.language);
          resolve(validLanguages);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error getting cached languages:", error);
      return [];
    }
  }

  /**
   * Clear cache for a specific story and language
   */
  async clearCache(storyId: string, language?: string): Promise<void> {
    try {
      const db = await this.initDB();
      
      const transaction = db.transaction(
        [CHAPTERS_STORE, METADATA_STORE],
        "readwrite"
      );
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
      const metadataStore = transaction.objectStore(METADATA_STORE);

      if (language) {
        // Clear specific language
        const chaptersIndex = chaptersStore.index("storyLanguage");
        const chaptersRequest = chaptersIndex.openCursor([storyId, language]);
        
        chaptersRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        metadataStore.delete([storyId, language]);
      } else {
        // Clear all languages for story
        const chaptersIndex = chaptersStore.index("storyId");
        const chaptersRequest = chaptersIndex.openCursor(storyId);
        
        chaptersRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        const metadataIndex = metadataStore.index("storyId");
        const metadataRequest = metadataIndex.openCursor(storyId);
        
        metadataRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          console.log(
            `[AUDIO_CACHE] Cleared cache for story ${storyId}${
              language ? ` (${language})` : ""
            }`
          );
          resolve();
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error clearing cache:", error);
    }
  }

  /**
   * Clear all expired caches
   */
  async clearExpiredCaches(): Promise<void> {
    try {
      const db = await this.initDB();
      const now = Date.now();
      
      const transaction = db.transaction(
        [CHAPTERS_STORE, METADATA_STORE],
        "readwrite"
      );
      const metadataStore = transaction.objectStore(METADATA_STORE);
      const chaptersStore = transaction.objectStore(CHAPTERS_STORE);
      const expiresIndex = metadataStore.index("expiresAt");
      
      // Find expired metadata
      const range = IDBKeyRange.upperBound(now);
      const request = expiresIndex.openCursor(range);
      
      const expiredKeys: Array<[string, string]> = [];
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const metadata = cursor.value as AudioCacheMetadata;
          expiredKeys.push([metadata.storyId, metadata.language]);
          cursor.delete();
          cursor.continue();
        }
      };

      return new Promise((resolve, reject) => {
        transaction.oncomplete = async () => {
          // Clear chapters for expired metadata
          for (const [storyId, language] of expiredKeys) {
            await this.clearCache(storyId, language);
          }
          console.log(`[AUDIO_CACHE] Cleared ${expiredKeys.length} expired caches`);
          resolve();
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error clearing expired caches:", error);
    }
  }

  /**
   * Get total cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAPTERS_STORE, "readonly");
        const store = transaction.objectStore(CHAPTERS_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
          const chapters = request.result || [];
          const totalSize = chapters.reduce(
            (sum: number, ch: CachedAudioChapter) => sum + ch.audioBlob.size,
            0
          );
          resolve(totalSize);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("[AUDIO_CACHE] Error getting cache size:", error);
      return 0;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.dbPromise = null;
      console.log("[AUDIO_CACHE] Database connection closed");
    }
  }
}

// Singleton instance
let audioLanguageCacheInstance: AudioLanguageCache | null = null;

/**
 * Get the audio language cache instance
 */
export function getAudioLanguageCache(): AudioLanguageCache {
  if (!audioLanguageCacheInstance) {
    audioLanguageCacheInstance = new AudioLanguageCache();
  }
  return audioLanguageCacheInstance;
}

/**
 * Dispose the audio language cache instance
 */
export function disposeAudioLanguageCache(): void {
  if (audioLanguageCacheInstance) {
    audioLanguageCacheInstance.close();
    audioLanguageCacheInstance = null;
  }
}
