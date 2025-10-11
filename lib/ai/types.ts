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
