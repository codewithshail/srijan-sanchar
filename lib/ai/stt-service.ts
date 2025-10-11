/**
 * Google Cloud Speech-to-Text Service
 * Supports Indian languages with high accuracy
 */

import { rateLimiter } from "./rate-limiter";
import { AIServiceError, STTRequest, STTResponse } from "./types";

// Supported languages for Google Cloud Speech-to-Text
export const SUPPORTED_STT_LANGUAGES = [
  { code: "en-IN", name: "English (India)", nativeName: "English" },
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

export class STTService {
  private apiKey: string;
  private endpoint: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(
    apiKey?: string,
    maxRetries: number = 3,
    retryDelayMs: number = 1000
  ) {
    this.apiKey = apiKey || process.env.GOOGLE_CLOUD_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    this.endpoint = "https://speech.googleapis.com/v1/speech:recognize";
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;

    if (!this.apiKey) {
      console.warn(
        "[STT_SERVICE] API key not configured. Service will use browser's Web Speech API as fallback."
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
   * Get supported languages
   */
  getSupportedLanguages() {
    return SUPPORTED_STT_LANGUAGES;
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(languageCode: string): boolean {
    return SUPPORTED_STT_LANGUAGES.some((lang) => lang.code === languageCode);
  }

  /**
   * Transcribe audio to text
   */
  async transcribe(request: STTRequest): Promise<STTResponse> {
    if (!this.isConfigured()) {
      return {
        error: "STT service is not configured. Please use browser's speech recognition.",
      };
    }

    if (!this.isLanguageSupported(request.language)) {
      return {
        error: `Language ${request.language} is not supported`,
      };
    }

    const allowed = await rateLimiter.checkLimit("stt");
    if (!allowed) {
      return {
        error: "Rate limit exceeded. Please try again later.",
      };
    }

    try {
      // Convert audio blob to base64
      const audioBase64 = await this.blobToBase64(request.audioBlob);

      const response = await this.executeWithRetry(async () => {
        return await fetch(`${this.endpoint}?key=${this.apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            config: {
              encoding: "WEBM_OPUS",
              sampleRateHertz: 48000,
              languageCode: request.language,
              enableAutomaticPunctuation: request.enableAutoPunctuation ?? true,
              model: "default",
              useEnhanced: true,
            },
            audio: {
              content: audioBase64,
            },
          }),
        });
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`STT API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const transcript = data.results
          .map((result: any) => result.alternatives[0].transcript)
          .join(" ");

        const confidence = data.results[0].alternatives[0].confidence;

        await rateLimiter.recordRequest("stt");

        return {
          transcript,
          confidence,
        };
      }

      return {
        transcript: "",
        confidence: 0,
      };
    } catch (error) {
      console.error("[STT_SERVICE] Transcription error:", error);
      return {
        error: error instanceof Error ? error.message : "Transcription failed",
      };
    }
  }

  /**
   * Stream transcription for real-time input using WebRTC
   */
  async streamTranscribe(
    audioStream: MediaStream,
    language: string,
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    if (typeof window === "undefined") {
      const error = new Error("Stream transcription only available in browser");
      onError?.(error);
      throw error;
    }

    // Use Web Speech API for browser-based streaming
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const error = new Error("Speech recognition not supported in this browser");
      onError?.(error);
      throw error;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      try {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const isFinal = result.isFinal;
        onTranscript(transcript, isFinal);
      } catch (err) {
        console.error("[STT_SERVICE] Result processing error:", err);
        onError?.(err instanceof Error ? err : new Error("Result processing failed"));
      }
    };

    recognition.onerror = (event: any) => {
      console.error("[STT_SERVICE] Recognition error:", event.error);
      onError?.(new Error(`Recognition error: ${event.error}`));
    };

    recognition.onend = () => {
      console.log("[STT_SERVICE] Recognition ended");
    };

    try {
      recognition.start();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recognition");
      onError?.(error);
      throw error;
    }

    // Return stop function
    return () => {
      try {
        recognition.stop();
      } catch (err) {
        console.error("[STT_SERVICE] Error stopping recognition:", err);
      }
    };
  }

  /**
   * Stream transcription using WebRTC and MediaRecorder
   * Sends audio chunks to the API for transcription
   */
  async streamTranscribeWithWebRTC(
    audioStream: MediaStream,
    language: string,
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    if (!this.isConfigured()) {
      const error = new Error("STT service is not configured");
      onError?.(error);
      throw error;
    }

    if (typeof window === "undefined" || !window.MediaRecorder) {
      const error = new Error("MediaRecorder not supported");
      onError?.(error);
      throw error;
    }

    let mediaRecorder: MediaRecorder;
    let isRecording = true;

    try {
      // Create MediaRecorder with appropriate MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      mediaRecorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 48000,
      });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && isRecording) {
          try {
            const result = await this.transcribe({
              audioBlob: event.data,
              language,
              enableAutoPunctuation: true,
            });

            if (result.error) {
              onError?.(new Error(result.error));
            } else if (result.transcript) {
              onTranscript(result.transcript, true);
            }
          } catch (err) {
            console.error("[STT_SERVICE] Transcription error:", err);
            onError?.(err instanceof Error ? err : new Error("Transcription failed"));
          }
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("[STT_SERVICE] MediaRecorder error:", event.error);
        onError?.(new Error(`MediaRecorder error: ${event.error}`));
      };

      // Start recording with 2-second chunks
      mediaRecorder.start(2000);

      console.log("[STT_SERVICE] WebRTC streaming started");
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start MediaRecorder");
      onError?.(error);
      throw error;
    }

    // Return stop function
    return () => {
      isRecording = false;
      try {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
          audioStream.getTracks().forEach((track) => track.stop());
        }
        console.log("[STT_SERVICE] WebRTC streaming stopped");
      } catch (err) {
        console.error("[STT_SERVICE] Error stopping MediaRecorder:", err);
      }
    };
  }

  /**
   * Convert blob to base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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
          `[STT_SERVICE] Retry attempt ${attempt + 1}/${
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
        message.includes("503")
      );
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

// Export singleton instance
export const sttService = new STTService();
