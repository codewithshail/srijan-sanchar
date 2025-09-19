import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SarvamTTSService } from '../../ai/sarvam-tts';

// Mock the environment variable
vi.mock('process', () => ({
  env: {
    SARVAM_API_KEY: 'test-api-key'
  }
}));

describe('Sarvam TTS Integration with IntelligentTextChunker', () => {
  let sarvamService: SarvamTTSService;

  beforeEach(() => {
    sarvamService = new SarvamTTSService('test-api-key');
    
    // Mock fetch to avoid actual API calls
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        audios: ['base64audiodata']
      })
    });
  });

  it('should use IntelligentTextChunker for streaming audio', async () => {
    const longText = `This is the first paragraph with some content that should be chunked intelligently.

This is the second paragraph with different content that also needs to be processed.

This is the third paragraph with even more content to test the chunking algorithm thoroughly.`;

    const chunks: Array<{ chunk: ArrayBuffer; index: number; total: number }> = [];
    
    try {
      for await (const chunk of sarvamService.streamAudio({
        text: longText,
        language: 'en-IN'
      })) {
        chunks.push(chunk);
      }
    } catch (error) {
      // Expected to fail due to mocked API, but we can still test chunking
    }

    // The service should have attempted to create multiple chunks
    expect(global.fetch).toHaveBeenCalled();
    
    // Verify that fetch was called multiple times (once per chunk)
    const fetchCalls = (global.fetch as any).mock.calls;
    expect(fetchCalls.length).toBeGreaterThan(1);
    
    // Verify that each call contains reasonable chunk sizes
    fetchCalls.forEach((call: any) => {
      const requestBody = JSON.parse(call[1].body);
      expect(requestBody.text.length).toBeLessThanOrEqual(600);
      expect(requestBody.text.length).toBeGreaterThan(0);
    });
  });

  it('should handle short text without chunking', async () => {
    const shortText = 'This is a short text that should not be chunked.';

    try {
      for await (const chunk of sarvamService.streamAudio({
        text: shortText,
        language: 'en-IN'
      })) {
        // Process chunk
      }
    } catch (error) {
      // Expected to fail due to mocked API
    }

    // Should only make one API call for short text
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
    expect(requestBody.text).toBe(shortText);
  });

  it('should preserve text content across chunks', async () => {
    const originalText = 'First sentence. Second sentence. Third sentence with more content.';
    
    const fetchCalls: string[] = [];
    
    // Mock fetch to capture the text being sent
    global.fetch = vi.fn().mockImplementation((url, options) => {
      const body = JSON.parse(options.body);
      fetchCalls.push(body.text);
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          audios: ['base64audiodata']
        })
      });
    });

    try {
      for await (const chunk of sarvamService.streamAudio({
        text: originalText,
        language: 'en-IN'
      })) {
        // Process chunk
      }
    } catch (error) {
      // Expected to fail due to mocked API
    }

    // Reconstruct text from chunks
    const reconstructedText = fetchCalls.join(' ');
    
    // The reconstructed text should contain all the key words from the original
    const originalWords = originalText.toLowerCase().split(/\s+/);
    const reconstructedWords = reconstructedText.toLowerCase().split(/\s+/);
    
    originalWords.forEach(word => {
      expect(reconstructedWords.some(rWord => rWord.includes(word.replace(/[.,!?]/, '')))).toBe(true);
    });
  });
});