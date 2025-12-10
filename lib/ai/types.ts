/**
 * Common types for AI services
 */

export interface AIServiceConfig {
  apiKey: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
}

export interface AIServiceError {
  type: 'rate_limit' | 'api_error' | 'network' | 'timeout' | 'validation' | 'unknown';
  message: string;
  retryable: boolean;
  retryAfter?: number;
  originalError?: Error;
}

export interface GenerationConfig {
  includeAIImages?: boolean;
  numberOfPages?: number;
  improveGrammar?: boolean;
  tone?: 'formal' | 'casual' | 'poetic' | 'narrative';
  targetAudience?: 'children' | 'adults' | 'all';
  imageStyle?: 'realistic' | 'artistic' | 'minimalist';
}

export interface ImageGenerationRequest {
  prompt: string;
  style?: string;
  aspectRatio?: string;
  numberOfImages?: number;
}

export interface ImageGenerationResult {
  imageBytes: string;
  prompt: string;
  index: number;
}

export interface OptimizedImageResult extends ImageGenerationResult {
  /** URL of the optimized image (if uploaded) */
  url?: string;
  /** Optimization settings applied */
  optimization?: {
    target: 'web' | 'print';
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  };
  /** Whether this is a fallback/placeholder image */
  isFallback?: boolean;
  /** Error message if generation failed */
  error?: string;
}

export interface ImageGenerationJobConfig {
  numberOfImages?: number;
  imageStyle?: 'realistic' | 'artistic' | 'minimalist';
  aspectRatio?: '16:9' | '4:3' | '1:1';
  targetAudience?: 'children' | 'adults' | 'all';
  optimizeForPrint?: boolean;
  generateThumbnails?: boolean;
}

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

export interface STTRequest {
  audioBlob: Blob;
  language: string;
  enableAutoPunctuation?: boolean;
}

export interface STTResponse {
  transcript?: string;
  confidence?: number;
  error?: string;
}

export interface STTStreamOptions {
  language: string;
  onTranscript: (text: string, isFinal: boolean) => void;
  onError?: (error: Error) => void;
  useWebRTC?: boolean;
}
