import { describe, it, expect } from 'vitest';
import { createWAVAudioChunkManager } from '../wav-chunk-manager';

describe('WAV Audio Integration Tests', () => {
  describe('Real-world Audio Streaming Scenarios', () => {
    it('should handle typical TTS streaming workflow', () => {
      const manager = createWAVAudioChunkManager();
      
      // Simulate receiving chunks from TTS API
      const chunk1 = createTestWAVFile(22050, 1, 16, 1000);
      const chunk2 = createTestWAVFile(22050, 1, 16, 1200);
      const chunk3 = createTestWAVFile(22050, 1, 16, 800);
      
      // Set expected total
      manager.setTotalChunks(3);
      
      // Add chunks as they arrive
      manager.addChunk(chunk1, 0);
      expect(manager.getProgress()).toBeCloseTo(33.33, 1);
      
      manager.addChunk(chunk2, 1);
      expect(manager.getProgress()).toBeCloseTo(66.67, 1);
      
      manager.addChunk(chunk3, 2);
      expect(manager.getProgress()).toBe(100);
      
      // Combine all chunks
      const combined = manager.combineChunks();
      
      // Verify the result
      expect(manager.validateChunk(combined)).toBe(true);
      expect(combined.byteLength).toBe(44 + 1000 + 1200 + 800); // Header + all audio data
    });

    it('should handle chunks arriving out of order', () => {
      const manager = createWAVAudioChunkManager();
      
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      const chunk2 = createTestWAVFile(22050, 1, 16, 600);
      const chunk3 = createTestWAVFile(22050, 1, 16, 700);
      
      manager.setTotalChunks(3);
      
      // Add chunks out of order
      manager.addChunk(chunk3, 2); // Third chunk first
      manager.addChunk(chunk1, 0); // First chunk second
      manager.addChunk(chunk2, 1); // Second chunk last
      
      const combined = manager.combineChunks();
      
      // Should still create valid WAV file with correct order
      expect(manager.validateChunk(combined)).toBe(true);
      expect(combined.byteLength).toBe(44 + 500 + 600 + 700);
    });

    it('should handle single chunk scenario', () => {
      const manager = createWAVAudioChunkManager();
      
      const singleChunk = createTestWAVFile(22050, 1, 16, 2000);
      
      manager.setTotalChunks(1);
      manager.addChunk(singleChunk, 0);
      
      expect(manager.getProgress()).toBe(100);
      
      const result = manager.combineChunks();
      
      // Should return the same chunk (no processing needed)
      expect(result).toBe(singleChunk);
      expect(manager.validateChunk(result)).toBe(true);
    });

    it('should handle empty scenario gracefully', () => {
      const manager = createWAVAudioChunkManager();
      
      const result = manager.combineChunks();
      
      expect(result.byteLength).toBe(0);
      expect(manager.getProgress()).toBe(0);
    });

    it('should maintain audio quality parameters', () => {
      const manager = createWAVAudioChunkManager();
      
      // Create chunks with specific audio parameters
      const sampleRate = 44100;
      const channels = 2; // Stereo
      const bitsPerSample = 16;
      
      const chunk1 = createTestWAVFile(sampleRate, channels, bitsPerSample, 1000);
      const chunk2 = createTestWAVFile(sampleRate, channels, bitsPerSample, 1500);
      
      manager.addChunk(chunk1, 0);
      manager.addChunk(chunk2, 1);
      
      const combined = manager.combineChunks();
      
      // Parse the combined file to verify parameters
      const header = (manager as any).parseWAVHeader(combined);
      
      expect(header.sampleRate).toBe(sampleRate);
      expect(header.channels).toBe(channels);
      expect(header.bitsPerSample).toBe(bitsPerSample);
      expect(header.audioDataSize).toBe(1000 + 1500);
    });

    it('should handle large number of chunks', () => {
      const manager = createWAVAudioChunkManager();
      
      const numChunks = 10;
      const chunkSize = 500;
      
      manager.setTotalChunks(numChunks);
      
      // Add many small chunks
      for (let i = 0; i < numChunks; i++) {
        const chunk = createTestWAVFile(22050, 1, 16, chunkSize);
        manager.addChunk(chunk, i);
      }
      
      expect(manager.getProgress()).toBe(100);
      expect(manager.getChunkCount()).toBe(numChunks);
      
      const combined = manager.combineChunks();
      
      expect(manager.validateChunk(combined)).toBe(true);
      expect(combined.byteLength).toBe(44 + (numChunks * chunkSize));
    });

    it('should reset properly for reuse', () => {
      const manager = createWAVAudioChunkManager();
      
      // First use
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      manager.setTotalChunks(1);
      manager.addChunk(chunk1, 0);
      
      expect(manager.getChunkCount()).toBe(1);
      expect(manager.getProgress()).toBe(100);
      
      // Reset
      manager.reset();
      
      expect(manager.getChunkCount()).toBe(0);
      expect(manager.getTotalChunks()).toBe(0);
      expect(manager.getProgress()).toBe(0);
      
      // Second use
      const chunk2 = createTestWAVFile(44100, 2, 16, 1000);
      manager.setTotalChunks(1);
      manager.addChunk(chunk2, 0);
      
      expect(manager.getChunkCount()).toBe(1);
      expect(manager.getProgress()).toBe(100);
      
      const result = manager.combineChunks();
      expect(manager.validateChunk(result)).toBe(true);
    });
  });

  describe('Error Recovery and Validation', () => {
    it('should validate chunks before adding', () => {
      const manager = createWAVAudioChunkManager();
      
      const validChunk = createTestWAVFile(22050, 1, 16, 500);
      const invalidChunk = new ArrayBuffer(100); // Too small to be valid WAV
      
      // Valid chunk should work
      expect(() => manager.addChunk(validChunk, 0)).not.toThrow();
      
      // Invalid chunk should throw
      expect(() => manager.addChunk(invalidChunk, 1)).toThrow();
      
      // Manager should still work with valid chunks
      expect(manager.getChunkCount()).toBe(1);
      const result = manager.combineChunks();
      expect(manager.validateChunk(result)).toBe(true);
    });

    it('should handle format inconsistencies gracefully', () => {
      const manager = createWAVAudioChunkManager();
      
      const chunk1 = createTestWAVFile(22050, 1, 16, 500);
      const chunk2 = createTestWAVFile(44100, 1, 16, 600); // Different sample rate
      const chunk3 = createTestWAVFile(22050, 2, 16, 400); // Different channels
      
      manager.addChunk(chunk1, 0);
      
      // Should not throw but log warnings
      expect(() => manager.addChunk(chunk2, 1)).not.toThrow();
      expect(() => manager.addChunk(chunk3, 2)).not.toThrow();
      
      // Should still create a combined file
      const combined = manager.combineChunks();
      expect(manager.validateChunk(combined)).toBe(true);
      
      // Should use the format from the first chunk
      const header = (manager as any).parseWAVHeader(combined);
      expect(header.sampleRate).toBe(22050); // From first chunk
      expect(header.channels).toBe(1); // From first chunk
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

  // Fill with test audio data (simple pattern)
  const audioView = new Uint8Array(buffer, 44);
  for (let i = 0; i < audioDataSize; i += 2) {
    // Simple 16-bit pattern
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