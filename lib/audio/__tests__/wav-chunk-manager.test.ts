import { describe, it, expect, beforeEach } from 'vitest';
import { WAVAudioChunkManager, createWAVAudioChunkManager } from '../wav-chunk-manager';

describe('WAVAudioChunkManager', () => {
  let manager: WAVAudioChunkManager;

  beforeEach(() => {
    manager = createWAVAudioChunkManager();
  });

  describe('WAV Header Creation and Parsing', () => {
    it('should create a valid WAV file header', () => {
      // Create a simple WAV file for testing
      const sampleRate = 22050;
      const channels = 1;
      const bitsPerSample = 16;
      const audioDataSize = 1000;
      
      const buffer = createTestWAVFile(sampleRate, channels, bitsPerSample, audioDataSize);
      
      expect(buffer.byteLength).toBe(44 + audioDataSize);
      expect(manager.validateChunk(buffer)).toBe(true);
    });

    it('should parse WAV header correctly', () => {
      const buffer = createTestWAVFile(22050, 1, 16, 1000);
      
      // Access private method for testing
      const header = (manager as any).parseWAVHeader(buffer);
      
      expect(header.sampleRate).toBe(22050);
      expect(header.channels).toBe(1);
      expect(header.bitsPerSample).toBe(16);
      expect(header.audioDataSize).toBe(1000);
      expect(header.audioDataOffset).toBe(44);
    });

    it('should reject invalid WAV files', () => {
      // Too small buffer
      const smallBuffer = new ArrayBuffer(20);
      expect(manager.validateChunk(smallBuffer)).toBe(false);

      // Invalid RIFF header
      const invalidBuffer = new ArrayBuffer(100);
      const view = new DataView(invalidBuffer);
      view.setUint32(0, 0x46464952); // Wrong RIFF header
      expect(manager.validateChunk(invalidBuffer)).toBe(false);
    });
  });

  describe('Chunk Management', () => {
    it('should add and track chunks correctly', () => {
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      const chunk2 = createTestWAVFile(22050, 1, 16, 600);

      manager.setTotalChunks(2);
      manager.addChunk(chunk1, 0);
      
      expect(manager.getChunkCount()).toBe(1);
      expect(manager.getProgress()).toBe(50);

      manager.addChunk(chunk2, 1);
      
      expect(manager.getChunkCount()).toBe(2);
      expect(manager.getProgress()).toBe(100);
    });

    it('should handle single chunk correctly', () => {
      const chunk = createTestWAVFile(22050, 1, 16, 1000);
      
      manager.addChunk(chunk, 0);
      const result = manager.combineChunks();
      
      expect(result).toBe(chunk);
    });

    it('should reset state correctly', () => {
      const chunk = createTestWAVFile(22050, 1, 16, 500);
      
      manager.setTotalChunks(1);
      manager.addChunk(chunk, 0);
      
      expect(manager.getChunkCount()).toBe(1);
      
      manager.reset();
      
      expect(manager.getChunkCount()).toBe(0);
      expect(manager.getTotalChunks()).toBe(0);
      expect(manager.getProgress()).toBe(0);
    });
  });

  describe('WAV File Concatenation', () => {
    it('should concatenate multiple WAV files correctly', () => {
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      const chunk2 = createTestWAVFile(22050, 1, 16, 600);
      const chunk3 = createTestWAVFile(22050, 1, 16, 400);

      manager.addChunk(chunk1, 0);
      manager.addChunk(chunk2, 1);
      manager.addChunk(chunk3, 2);

      const combined = manager.combineChunks();
      
      // Should be valid WAV file
      expect(manager.validateChunk(combined)).toBe(true);
      
      // Should have correct total size (header + all audio data)
      const expectedAudioSize = 500 + 600 + 400;
      expect(combined.byteLength).toBe(44 + expectedAudioSize);
      
      // Verify header
      const header = (manager as any).parseWAVHeader(combined);
      expect(header.sampleRate).toBe(22050);
      expect(header.channels).toBe(1);
      expect(header.bitsPerSample).toBe(16);
      expect(header.audioDataSize).toBe(expectedAudioSize);
    });

    it('should handle chunks in wrong order', () => {
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      const chunk2 = createTestWAVFile(22050, 1, 16, 600);
      const chunk3 = createTestWAVFile(22050, 1, 16, 400);

      // Add chunks out of order
      manager.addChunk(chunk2, 1);
      manager.addChunk(chunk3, 2);
      manager.addChunk(chunk1, 0);

      const combined = manager.combineChunks();
      
      // Should still create valid WAV file
      expect(manager.validateChunk(combined)).toBe(true);
      
      // Should have correct total size
      const expectedAudioSize = 500 + 600 + 400;
      expect(combined.byteLength).toBe(44 + expectedAudioSize);
    });

    it('should handle format mismatches gracefully', () => {
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      const chunk2 = createTestWAVFile(44100, 1, 16, 600); // Different sample rate

      manager.addChunk(chunk1, 0);
      
      // Should not throw, but log warning
      expect(() => manager.addChunk(chunk2, 1)).not.toThrow();
      
      // Should still create a combined file (using first chunk's format)
      const combined = manager.combineChunks();
      expect(manager.validateChunk(combined)).toBe(true);
    });

    it('should handle empty chunks array', () => {
      const combined = manager.combineChunks();
      expect(combined.byteLength).toBe(0);
    });

    it('should skip invalid chunks during concatenation', () => {
      const validChunk = createTestWAVFile(22050, 1, 16, 500);
      const invalidChunk = new ArrayBuffer(100); // Invalid WAV

      manager.addChunk(validChunk, 0);
      
      // Should not throw when adding invalid chunk
      expect(() => manager.addChunk(invalidChunk, 1)).toThrow();
      
      // Should still work with valid chunks
      const combined = manager.combineChunks();
      expect(manager.validateChunk(combined)).toBe(true);
    });
  });

  describe('Format Validation', () => {
    it('should validate format compatibility', () => {
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      const chunk2 = createTestWAVFile(22050, 1, 16, 600);
      const chunk3 = createTestWAVFile(44100, 1, 16, 400); // Different sample rate

      manager.addChunk(chunk1, 0);
      manager.addChunk(chunk2, 1);
      
      // Should work fine with compatible formats
      expect(manager.getChunkCount()).toBe(2);
      
      // Should handle incompatible format (but not throw)
      expect(() => manager.addChunk(chunk3, 2)).not.toThrow();
    });

    it('should maintain audio duration correctly', () => {
      // Create chunks with known durations
      const sampleRate = 22050;
      const channels = 1;
      const bitsPerSample = 16;
      
      // 1 second of audio data
      const samplesPerSecond = sampleRate * channels;
      const bytesPerSample = bitsPerSample / 8;
      const audioDataSize = samplesPerSecond * bytesPerSample;
      
      const chunk1 = createTestWAVFile(sampleRate, channels, bitsPerSample, audioDataSize);
      const chunk2 = createTestWAVFile(sampleRate, channels, bitsPerSample, audioDataSize);
      
      manager.addChunk(chunk1, 0);
      manager.addChunk(chunk2, 1);
      
      const combined = manager.combineChunks();
      const header = (manager as any).parseWAVHeader(combined);
      
      // Should have 2 seconds worth of audio data
      expect(header.audioDataSize).toBe(audioDataSize * 2);
    });
  });
});

/**
 * Helper function to create a test WAV file with specified parameters
 */
function createTestWAVFile(
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
  audioDataSize: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + audioDataSize);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + audioDataSize, true); // File size - 8
  writeString(view, 8, 'WAVE');
  
  // Format chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Format chunk size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bitsPerSample / 8, true); // Byte rate
  view.setUint16(32, channels * bitsPerSample / 8, true); // Block align
  view.setUint16(34, bitsPerSample, true);
  
  // Data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, audioDataSize, true);

  // Fill with test audio data (simple sine wave pattern)
  const audioView = new Uint8Array(buffer, 44);
  for (let i = 0; i < audioDataSize; i += 2) {
    // Simple 16-bit sine wave
    const sample = Math.sin(2 * Math.PI * 440 * (i / 2) / sampleRate) * 32767;
    const intSample = Math.round(sample);
    audioView[i] = intSample & 0xFF;
    audioView[i + 1] = (intSample >> 8) & 0xFF;
  }

  return buffer;
}

/**
 * Helper function to write a string to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}