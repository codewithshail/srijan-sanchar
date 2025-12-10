/**
 * Audio Optimizer Module
 * 
 * Provides audio file optimization capabilities including:
 * - Audio compression and format conversion
 * - Bitrate optimization
 * - File size reduction
 * - Quality presets
 * 
 * Requirements: 8.2, 8.3
 */

/**
 * Audio optimization configuration
 */
export interface AudioOptimizationConfig {
  /** Target bitrate in kbps */
  targetBitrate?: number;
  /** Target sample rate in Hz */
  targetSampleRate?: number;
  /** Number of channels (1 for mono, 2 for stereo) */
  channels?: number;
  /** Enable normalization */
  normalize?: boolean;
  /** Target format */
  format?: 'wav' | 'mp3' | 'ogg' | 'webm';
}

/**
 * Audio optimization result
 */
export interface AudioOptimizationResult {
  data: ArrayBuffer;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  format: string;
  duration: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
}

/**
 * Audio quality presets
 */
export const AUDIO_QUALITY_PRESETS = {
  low: {
    targetBitrate: 64,
    targetSampleRate: 22050,
    channels: 1,
    normalize: true,
  },
  medium: {
    targetBitrate: 128,
    targetSampleRate: 44100,
    channels: 1,
    normalize: true,
  },
  high: {
    targetBitrate: 192,
    targetSampleRate: 44100,
    channels: 2,
    normalize: true,
  },
  ultra: {
    targetBitrate: 320,
    targetSampleRate: 48000,
    channels: 2,
    normalize: false,
  },
} as const;

export type AudioQualityPreset = keyof typeof AUDIO_QUALITY_PRESETS;

/**
 * Default optimization configuration
 */
const DEFAULT_CONFIG: Required<AudioOptimizationConfig> = {
  targetBitrate: 128,
  targetSampleRate: 44100,
  channels: 1,
  normalize: true,
  format: 'wav',
};

/**
 * Audio Optimizer class
 * 
 * Provides methods for optimizing audio files for streaming
 */
export class AudioOptimizer {
  private config: Required<AudioOptimizationConfig>;

  constructor(config: AudioOptimizationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Apply a quality preset
   */
  applyPreset(preset: AudioQualityPreset): void {
    const presetConfig = AUDIO_QUALITY_PRESETS[preset];
    this.config = { ...this.config, ...presetConfig };
  }

  /**
   * Analyze audio buffer and return metadata
   */
  analyzeAudio(audioData: ArrayBuffer): {
    format: string;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    duration: number;
    size: number;
    estimatedBitrate: number;
  } {
    const view = new DataView(audioData);
    
    // Check for WAV format
    const riffHeader = this.readString(view, 0, 4);
    if (riffHeader !== 'RIFF') {
      throw new Error('Unsupported audio format (only WAV supported)');
    }

    // Parse WAV header
    const channels = view.getUint16(22, true);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    
    // Find data chunk
    let dataOffset = 12;
    let dataSize = 0;
    
    while (dataOffset < audioData.byteLength - 8) {
      const chunkId = this.readString(view, dataOffset, 4);
      const chunkSize = view.getUint32(dataOffset + 4, true);
      
      if (chunkId === 'data') {
        dataSize = chunkSize;
        break;
      }
      
      dataOffset += 8 + chunkSize;
    }

    const duration = dataSize / (sampleRate * channels * (bitsPerSample / 8));
    const estimatedBitrate = (audioData.byteLength * 8) / duration / 1000;

    return {
      format: 'wav',
      sampleRate,
      channels,
      bitsPerSample,
      duration,
      size: audioData.byteLength,
      estimatedBitrate: Math.round(estimatedBitrate),
    };
  }

  /**
   * Optimize audio for streaming
   * 
   * Note: Full audio transcoding requires server-side processing with FFmpeg.
   * This method provides client-side optimizations where possible.
   */
  async optimizeForStreaming(
    audioData: ArrayBuffer,
    config?: Partial<AudioOptimizationConfig>
  ): Promise<AudioOptimizationResult> {
    const mergedConfig = { ...this.config, ...config };
    const originalSize = audioData.byteLength;

    try {
      const analysis = this.analyzeAudio(audioData);
      
      // Check if optimization is needed
      const needsOptimization = 
        analysis.sampleRate > mergedConfig.targetSampleRate ||
        analysis.channels > mergedConfig.channels ||
        analysis.estimatedBitrate > mergedConfig.targetBitrate * 1.5;

      if (!needsOptimization) {
        console.log('[AUDIO_OPTIMIZER] Audio already optimized, skipping');
        return {
          data: audioData,
          originalSize,
          optimizedSize: originalSize,
          compressionRatio: 1,
          format: analysis.format,
          duration: analysis.duration,
          sampleRate: analysis.sampleRate,
          channels: analysis.channels,
          bitrate: analysis.estimatedBitrate,
        };
      }

      // Perform client-side optimization using Web Audio API
      const optimizedData = await this.processWithWebAudio(
        audioData,
        mergedConfig
      );

      const optimizedSize = optimizedData.byteLength;
      const compressionRatio = originalSize / optimizedSize;

      console.log(`[AUDIO_OPTIMIZER] Optimized: ${originalSize} -> ${optimizedSize} bytes (${compressionRatio.toFixed(2)}x)`);

      return {
        data: optimizedData,
        originalSize,
        optimizedSize,
        compressionRatio,
        format: mergedConfig.format,
        duration: analysis.duration,
        sampleRate: mergedConfig.targetSampleRate,
        channels: mergedConfig.channels,
        bitrate: mergedConfig.targetBitrate,
      };
    } catch (error) {
      console.error('[AUDIO_OPTIMIZER] Optimization failed:', error);
      // Return original data if optimization fails
      return {
        data: audioData,
        originalSize,
        optimizedSize: originalSize,
        compressionRatio: 1,
        format: 'wav',
        duration: 0,
        sampleRate: this.config.targetSampleRate,
        channels: this.config.channels,
        bitrate: 0,
      };
    }
  }

  /**
   * Process audio using Web Audio API
   */
  private async processWithWebAudio(
    audioData: ArrayBuffer,
    config: Required<AudioOptimizationConfig>
  ): Promise<ArrayBuffer> {
    // Create audio context with target sample rate
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: config.targetSampleRate,
    });

    try {
      // Decode audio data
      const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

      // Create offline context for processing
      const offlineContext = new OfflineAudioContext(
        config.channels,
        audioBuffer.length * (config.targetSampleRate / audioBuffer.sampleRate),
        config.targetSampleRate
      );

      // Create buffer source
      const source = offlineContext.createBufferSource();
      source.buffer = audioBuffer;

      // Apply normalization if enabled
      if (config.normalize) {
        const gainNode = offlineContext.createGain();
        const maxAmplitude = this.getMaxAmplitude(audioBuffer);
        const normalizeGain = maxAmplitude > 0 ? 0.95 / maxAmplitude : 1;
        gainNode.gain.value = normalizeGain;
        
        source.connect(gainNode);
        gainNode.connect(offlineContext.destination);
      } else {
        source.connect(offlineContext.destination);
      }

      source.start();

      // Render processed audio
      const renderedBuffer = await offlineContext.startRendering();

      // Convert to WAV format
      const wavData = this.audioBufferToWav(renderedBuffer);

      return wavData;
    } finally {
      await audioContext.close();
    }
  }

  /**
   * Get maximum amplitude from audio buffer
   */
  private getMaxAmplitude(audioBuffer: AudioBuffer): number {
    let maxAmplitude = 0;
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < channelData.length; i++) {
        const amplitude = Math.abs(channelData[i]);
        if (amplitude > maxAmplitude) {
          maxAmplitude = amplitude;
        }
      }
    }
    
    return maxAmplitude;
  }

  /**
   * Convert AudioBuffer to WAV format
   */
  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioBuffer.length * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // Write WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const offset = 44;
    const channelData: Float32Array[] = [];
    
    for (let channel = 0; channel < numChannels; channel++) {
      channelData.push(audioBuffer.getChannelData(channel));
    }

    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset + (i * blockAlign) + (channel * bytesPerSample), intSample, true);
      }
    }

    return buffer;
  }

  /**
   * Read string from DataView
   */
  private readString(view: DataView, offset: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(view.getUint8(offset + i));
    }
    return result;
  }

  /**
   * Write string to DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Estimate optimized file size
   */
  estimateOptimizedSize(
    originalSize: number,
    originalBitrate: number,
    targetBitrate: number
  ): number {
    if (originalBitrate <= 0) return originalSize;
    return Math.round(originalSize * (targetBitrate / originalBitrate));
  }

  /**
   * Get recommended quality preset based on network conditions
   */
  getRecommendedPreset(
    connectionSpeed: number // in Mbps
  ): AudioQualityPreset {
    if (connectionSpeed < 1) return 'low';
    if (connectionSpeed < 5) return 'medium';
    if (connectionSpeed < 20) return 'high';
    return 'ultra';
  }
}

// Singleton instance
let optimizerInstance: AudioOptimizer | null = null;

/**
 * Get or create the audio optimizer instance
 */
export function getAudioOptimizer(
  config?: AudioOptimizationConfig
): AudioOptimizer {
  if (!optimizerInstance) {
    optimizerInstance = new AudioOptimizer(config);
  }
  return optimizerInstance;
}

/**
 * Create a new audio optimizer instance
 */
export function createAudioOptimizer(
  config?: AudioOptimizationConfig
): AudioOptimizer {
  return new AudioOptimizer(config);
}
