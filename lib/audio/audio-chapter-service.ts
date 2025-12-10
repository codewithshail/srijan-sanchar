/**
 * Audio Chapter Service
 * 
 * Provides comprehensive audio chapter generation functionality including:
 * - Intelligent chapter splitting based on target duration
 * - Integration with Sarvam Bulbul TTS
 * - Audio file storage management
 * - Chapter metadata persistence
 * 
 * Requirements: 8.2, 8.3
 */

import { db } from "@/lib/db";
import { audioChapters, stories } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { sarvamTTS, type TTSRequest, SUPPORTED_LANGUAGES } from "@/lib/ai/sarvam-tts";
import { cloudinaryService } from "@/lib/storage/cloudinary";

/**
 * Configuration for audio chapter generation
 */
export interface AudioChapterConfig {
  /** Target duration per chapter in seconds (default: 60) */
  targetDuration?: number;
  /** Language code for TTS (default: "en-IN") */
  language?: string;
  /** Speaker voice (default: "anushka") */
  speaker?: string;
  /** Speech pitch adjustment (-20 to 20) */
  pitch?: number;
  /** Speech pace (0.25 to 4.0) */
  pace?: number;
}

/**
 * Represents a text chunk for audio generation
 */
export interface TextChapter {
  text: string;
  startPosition: number;
  endPosition: number;
  estimatedDuration: number;
  wordCount: number;
}

/**
 * Represents a generated audio chapter
 */
export interface GeneratedAudioChapter {
  chapterIndex: number;
  audioUrl: string;
  duration: number;
  startPosition: number;
  endPosition: number;
  language: string;
}

/**
 * Result of audio chapter generation
 */
export interface AudioGenerationResult {
  success: boolean;
  storyId: string;
  chapters: GeneratedAudioChapter[];
  totalDuration: number;
  failedChapters: Array<{ index: number; error: string }>;
  language: string;
  speaker: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<AudioChapterConfig> = {
  targetDuration: 60, // 1 minute per chapter
  language: "en-IN",
  speaker: "anushka",
  pitch: 0,
  pace: 1.0,
};

/**
 * Average words per minute for speech (used for duration estimation)
 * This is calibrated for natural speech pace
 */
const WORDS_PER_MINUTE = 150;
const WORDS_PER_SECOND = WORDS_PER_MINUTE / 60;

/**
 * Audio Chapter Service class
 */
export class AudioChapterService {
  /**
   * Split text into chapters based on target duration
   * Uses intelligent splitting at natural breakpoints (paragraphs, sentences)
   */
  splitIntoChapters(text: string, targetDuration: number = 60): TextChapter[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const targetWords = Math.floor(targetDuration * WORDS_PER_SECOND);
    const chapters: TextChapter[] = [];

    // Normalize text
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .trim();

    // Split by paragraphs first
    const paragraphs = normalizedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChapter = "";
    let currentWordCount = 0;
    let startPos = 0;
    let currentPos = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      const paragraphWords = this.countWords(trimmedParagraph);
      const paragraphStartPos = normalizedText.indexOf(trimmedParagraph, currentPos);

      // If adding this paragraph exceeds target and we have content, save current chapter
      if (currentWordCount + paragraphWords > targetWords && currentChapter.trim()) {
        const estimatedDuration = Math.ceil(currentWordCount / WORDS_PER_SECOND);
        chapters.push({
          text: currentChapter.trim(),
          startPosition: startPos,
          endPosition: currentPos,
          estimatedDuration,
          wordCount: currentWordCount,
        });

        currentChapter = trimmedParagraph + "\n\n";
        currentWordCount = paragraphWords;
        startPos = paragraphStartPos;
      } else {
        currentChapter += trimmedParagraph + "\n\n";
        currentWordCount += paragraphWords;
      }

      currentPos = paragraphStartPos + trimmedParagraph.length;
    }

    // Add remaining content as last chapter
    if (currentChapter.trim()) {
      const estimatedDuration = Math.ceil(currentWordCount / WORDS_PER_SECOND);
      chapters.push({
        text: currentChapter.trim(),
        startPosition: startPos,
        endPosition: currentPos,
        estimatedDuration,
        wordCount: currentWordCount,
      });
    }

    // Handle case where a single chapter is too long
    const finalChapters: TextChapter[] = [];
    for (const chapter of chapters) {
      if (chapter.estimatedDuration > targetDuration * 1.5) {
        // Split long chapters by sentences
        const subChapters = this.splitLongChapter(chapter, targetDuration);
        finalChapters.push(...subChapters);
      } else {
        finalChapters.push(chapter);
      }
    }

    console.log(`[AUDIO_CHAPTER_SERVICE] Split text into ${finalChapters.length} chapters`);
    return finalChapters;
  }

  /**
   * Split a long chapter into smaller chunks by sentences
   */
  private splitLongChapter(chapter: TextChapter, targetDuration: number): TextChapter[] {
    const targetWords = Math.floor(targetDuration * WORDS_PER_SECOND);
    const sentences = this.extractSentences(chapter.text);
    const subChapters: TextChapter[] = [];

    let currentText = "";
    let currentWordCount = 0;
    let startPos = chapter.startPosition;

    for (const sentence of sentences) {
      const sentenceWords = this.countWords(sentence);

      if (currentWordCount + sentenceWords > targetWords && currentText.trim()) {
        const estimatedDuration = Math.ceil(currentWordCount / WORDS_PER_SECOND);
        subChapters.push({
          text: currentText.trim(),
          startPosition: startPos,
          endPosition: startPos + currentText.length,
          estimatedDuration,
          wordCount: currentWordCount,
        });

        startPos = startPos + currentText.length;
        currentText = sentence + " ";
        currentWordCount = sentenceWords;
      } else {
        currentText += sentence + " ";
        currentWordCount += sentenceWords;
      }
    }

    // Add remaining content
    if (currentText.trim()) {
      const estimatedDuration = Math.ceil(currentWordCount / WORDS_PER_SECOND);
      subChapters.push({
        text: currentText.trim(),
        startPosition: startPos,
        endPosition: chapter.endPosition,
        estimatedDuration,
        wordCount: currentWordCount,
      });
    }

    return subChapters;
  }

  /**
   * Extract sentences from text
   */
  private extractSentences(text: string): string[] {
    // Split on sentence-ending punctuation followed by space and capital letter
    const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])/;
    const parts = text.split(sentenceRegex);
    return parts.filter(s => s.trim().length > 0).map(s => s.trim());
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  /**
   * Generate audio for a single chapter
   */
  async generateChapterAudio(
    chapterText: string,
    config: AudioChapterConfig = {}
  ): Promise<{ audioData: ArrayBuffer; error?: string }> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    if (!sarvamTTS.isConfigured()) {
      return { audioData: new ArrayBuffer(0), error: "TTS service is not configured" };
    }

    const ttsRequest: TTSRequest = {
      text: chapterText,
      language: mergedConfig.language,
      speaker: mergedConfig.speaker,
      pitch: mergedConfig.pitch,
      pace: mergedConfig.pace,
    };

    const result = await sarvamTTS.generateAudio(ttsRequest);

    if (result.error) {
      return { audioData: new ArrayBuffer(0), error: result.error };
    }

    if (!result.audioData) {
      return { audioData: new ArrayBuffer(0), error: "No audio data received" };
    }

    return { audioData: result.audioData };
  }

  /**
   * Upload audio to storage
   */
  async uploadAudio(
    audioData: ArrayBuffer,
    storyId: string,
    chapterIndex: number,
    language: string
  ): Promise<string> {
    return await cloudinaryService.uploadAudio(
      audioData,
      storyId,
      chapterIndex,
      language
    );
  }

  /**
   * Save chapter metadata to database
   */
  async saveChapterMetadata(
    storyId: string,
    chapter: GeneratedAudioChapter
  ): Promise<void> {
    await db.insert(audioChapters).values({
      storyId,
      chapterIndex: chapter.chapterIndex,
      language: chapter.language,
      audioUrl: chapter.audioUrl,
      duration: chapter.duration,
      startPosition: chapter.startPosition,
      endPosition: chapter.endPosition,
    });
  }

  /**
   * Get existing audio chapters for a story
   */
  async getChapters(
    storyId: string,
    language?: string
  ): Promise<GeneratedAudioChapter[]> {
    const conditions = [eq(audioChapters.storyId, storyId)];
    
    if (language) {
      conditions.push(eq(audioChapters.language, language));
    }

    const chapters = await db
      .select()
      .from(audioChapters)
      .where(and(...conditions))
      .orderBy(asc(audioChapters.chapterIndex));

    return chapters.map(ch => ({
      chapterIndex: ch.chapterIndex,
      audioUrl: ch.audioUrl,
      duration: ch.duration || 0,
      startPosition: ch.startPosition || 0,
      endPosition: ch.endPosition || 0,
      language: ch.language,
    }));
  }

  /**
   * Delete existing audio chapters for a story (optionally by language)
   */
  async deleteChapters(storyId: string, language?: string): Promise<void> {
    const conditions = [eq(audioChapters.storyId, storyId)];
    
    if (language) {
      conditions.push(eq(audioChapters.language, language));
    }

    await db.delete(audioChapters).where(and(...conditions));
  }

  /**
   * Check if audio chapters exist for a story
   */
  async hasChapters(storyId: string, language?: string): Promise<boolean> {
    const chapters = await this.getChapters(storyId, language);
    return chapters.length > 0;
  }

  /**
   * Get available languages for audio generation
   */
  getAvailableLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Validate language code
   */
  isLanguageSupported(languageCode: string): boolean {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
  }

  /**
   * Generate all audio chapters for a story
   * This is the main entry point for audio generation
   */
  async generateAllChapters(
    storyId: string,
    config: AudioChapterConfig = {},
    onProgress?: (progress: number, message: string) => void
  ): Promise<AudioGenerationResult> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const failedChapters: Array<{ index: number; error: string }> = [];
    const generatedChapters: GeneratedAudioChapter[] = [];

    try {
      // Fetch story content
      const [story] = await db
        .select()
        .from(stories)
        .where(eq(stories.id, storyId));

      if (!story) {
        throw new Error(`Story ${storyId} not found`);
      }

      if (!story.content) {
        throw new Error("Story has no content to generate audio from");
      }

      onProgress?.(10, "Splitting story into chapters...");

      // Split into chapters
      const textChapters = this.splitIntoChapters(
        story.content,
        mergedConfig.targetDuration
      );

      if (textChapters.length === 0) {
        throw new Error("No chapters could be created from story content");
      }

      onProgress?.(20, `Created ${textChapters.length} chapters`);

      // Delete existing chapters for this language
      await this.deleteChapters(storyId, mergedConfig.language);

      // Generate audio for each chapter
      const progressPerChapter = 70 / textChapters.length;

      for (let i = 0; i < textChapters.length; i++) {
        const textChapter = textChapters[i];
        const currentProgress = 20 + (i * progressPerChapter);
        
        onProgress?.(
          Math.round(currentProgress),
          `Generating audio for chapter ${i + 1}/${textChapters.length}...`
        );

        try {
          // Generate audio
          const { audioData, error } = await this.generateChapterAudio(
            textChapter.text,
            mergedConfig
          );

          if (error || !audioData || audioData.byteLength === 0) {
            throw new Error(error || "No audio data generated");
          }

          // Upload to storage
          const audioUrl = await this.uploadAudio(
            audioData,
            storyId,
            i,
            mergedConfig.language
          );

          const generatedChapter: GeneratedAudioChapter = {
            chapterIndex: i,
            audioUrl,
            duration: textChapter.estimatedDuration,
            startPosition: textChapter.startPosition,
            endPosition: textChapter.endPosition,
            language: mergedConfig.language,
          };

          // Save to database
          await this.saveChapterMetadata(storyId, generatedChapter);
          generatedChapters.push(generatedChapter);

          console.log(`[AUDIO_CHAPTER_SERVICE] Generated chapter ${i + 1}/${textChapters.length}`);
        } catch (error) {
          console.error(`[AUDIO_CHAPTER_SERVICE] Failed to generate chapter ${i}:`, error);
          failedChapters.push({
            index: i,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      onProgress?.(95, "Finalizing audio generation...");

      const totalDuration = generatedChapters.reduce(
        (sum, ch) => sum + ch.duration,
        0
      );

      onProgress?.(100, "Audio generation complete!");

      return {
        success: generatedChapters.length > 0,
        storyId,
        chapters: generatedChapters,
        totalDuration,
        failedChapters,
        language: mergedConfig.language,
        speaker: mergedConfig.speaker,
      };
    } catch (error) {
      console.error("[AUDIO_CHAPTER_SERVICE] Generation failed:", error);
      return {
        success: false,
        storyId,
        chapters: generatedChapters,
        totalDuration: 0,
        failedChapters,
        language: mergedConfig.language,
        speaker: mergedConfig.speaker,
      };
    }
  }
}

// Export singleton instance
export const audioChapterService = new AudioChapterService();
