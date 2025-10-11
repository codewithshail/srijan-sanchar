import { z } from "zod";
import { intelligentTextChunker } from "../text-chunking/intelligent-text-chunker";
import { rateLimiter } from "./rate-limiter";
import { AIServiceError } from "./types";

// Sarvam AI Bulbul TTS API configuration
const SARVAM_BASE_URL = "https://api.sarvam.ai/text-to-speech";

// Supported languages for Sarvam AI Bulbul v2
export const SUPPORTED_LANGUAGES = [
  { code: "en-IN", name: "English", nativeName: "English" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिंदी" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "or-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
];

// Available speakers for Sarvam AI Bulbul v2
export const AVAILABLE_SPEAKERS = [
  { id: "anushka", name: "Anushka", gender: "female" },
  { id: "meera", name: "Meera", gender: "female" },
  { id: "arjun", name: "Arjun", gender: "male" },
  { id: "kavya", name: "Kavya", gender: "female" },
];

export interface TTSRequest {
  text: string;
  language: string;
  speaker?: string;
  pitch?: number;
  pace?: number;
}

export interface TTSResponse {
  audioUrl?: string;
  audioData?: ArrayBuffer;
  error?: string;
}

const ttsRequestSchema = z.object({
  text: z.string().min(1).max(8000), // Increased limit for longer content
  language: z.string().min(2).max(10),
  speaker: z.string().optional(),
  pitch: z.number().min(-20).max(20).optional(), // Sarvam AI uses -20 to 20 range
  pace: z.number().min(0.25).max(4.0).optional(), // Sarvam AI uses 0.25 to 4.0 range
});

export class SarvamTTSService {
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(apiKey?: string, maxRetries: number = 3, retryDelayMs: number = 1000) {
    this.apiKey = apiKey || process.env.SARVAM_API_KEY || "";
    this.baseUrl = SARVAM_BASE_URL;
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    
    if (!this.apiKey) {
      console.warn("SARVAM_API_KEY is not set. TTS service will not work.");
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }

  /**
   * Validate language code
   */
  isLanguageSupported(languageCode: string): boolean {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode);
  }

  /**
   * Generate audio using Sarvam AI Bulbul API
   */
  async generateAudio(request: TTSRequest): Promise<TTSResponse> {
    if (!this.isConfigured()) {
      return { error: "TTS service is not configured" };
    }

    const validation = ttsRequestSchema.safeParse(request);
    if (!validation.success) {
      return { error: "Invalid request parameters" };
    }

    const { text, language, speaker = "anushka", pitch = 0, pace = 1.0 } = validation.data;

    console.log('[SARVAM_TTS] Processing text length:', text.length);
    console.log('[SARVAM_TTS] Text preview:', text.substring(0, 200) + '...');

    if (!this.isLanguageSupported(language)) {
      return { error: `Language ${language} is not supported` };
    }

    // Check rate limit
    const allowed = await rateLimiter.checkLimit("tts");
    if (!allowed) {
      return { 
        error: `Rate limit exceeded. Please try again in ${Math.ceil(rateLimiter.getResetTime("tts") / 1000)}s` 
      };
    }

    try {
      const response = await this.executeWithRetry(async () => {
        return await fetch(this.baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "API-Subscription-Key": this.apiKey,
          },
          body: JSON.stringify({
            text: text,
            target_language_code: language,
            speaker: speaker,
            pitch: pitch,
            pace: pace,
            loudness: 1,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: "bulbul:v2",
          }),
        });
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[SARVAM_TTS_ERROR]", response.status, errorText);
        
        // Handle rate limiting
        if (response.status === 429) {
          return { error: "Rate limit exceeded. Please try again later." };
        }
        
        return { error: `TTS API error: ${response.status}` };
      }

      const responseData = await response.json();
      
      // Record successful request
      await rateLimiter.recordRequest("tts");
      console.log('[SARVAM_TTS] API Response keys:', Object.keys(responseData));
      console.log('[SARVAM_TTS] Audio count:', responseData.audios?.length || 0);
      
      // The response should contain audio data in base64 format
      if (responseData && responseData.audios && responseData.audios.length > 0) {
        console.log('[SARVAM_TTS] Processing', responseData.audios.length, 'audio chunks');
        
        if (responseData.audios.length === 1) {
          // Single chunk - process normally
          const base64Audio = responseData.audios[0];
          const binaryString = atob(base64Audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          console.log('[SARVAM_TTS] Single chunk size:', bytes.length, 'bytes');
          return { audioData: bytes.buffer };
        } else {
          // Multiple chunks - return the first chunk for now and log the issue
          console.log('[SARVAM_TTS] WARNING: Multiple audio chunks detected, using first chunk only');
          console.log('[SARVAM_TTS] This is a known limitation - audio concatenation needs proper WAV file handling');
          
          const base64Audio = responseData.audios[0];
          const binaryString = atob(base64Audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          console.log('[SARVAM_TTS] Using first chunk size:', bytes.length, 'bytes');
          return { audioData: bytes.buffer };
        }
      } else {
        return { error: "No audio data received from API" };
      }

    } catch (error) {
      console.error("[SARVAM_TTS_ERROR]", error);
      return { error: "Failed to generate audio" };
    }
  }

  /**
   * Stream audio for long text content
   * Splits text into chunks and generates audio progressively
   */
  async* streamAudio(request: TTSRequest): AsyncGenerator<{ chunk: ArrayBuffer; index: number; total: number }> {
    const { text, ...otherParams } = request;
    
    // Use the intelligent text chunker for better text splitting
    const textChunks = intelligentTextChunker.splitText(text, {
      maxChunkSize: 600, // Smaller chunks for single audio responses
      minChunkSize: 50,
      splitStrategy: 'hybrid'
    });
    
    console.log('[SARVAM_TTS] Using IntelligentTextChunker - created', textChunks.length, 'chunks for sequential playback');
    
    for (let i = 0; i < textChunks.length; i++) {
      const chunkRequest = { ...otherParams, text: textChunks[i].text };
      const result = await this.generateAudio(chunkRequest);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.audioData) {
        yield {
          chunk: result.audioData,
          index: i,
          total: textChunks.length,
        };
      }
    }
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
          `[SARVAM_TTS] Retry attempt ${attempt + 1}/${
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
        message.includes("econnreset")
      );
    }
    // Also retry on Response objects with retryable status codes
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      return status === 503 || status === 500;
    }
    return false;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export a singleton instance
export const sarvamTTS = new SarvamTTSService();