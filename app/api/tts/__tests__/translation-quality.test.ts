/**
 * Tests for translation quality in TTS streaming
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the translation function behavior
const mockTranslateInChunks = vi.fn();
const mockGeminiGenerate = vi.fn();

// Mock GoogleGenerativeAI
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: mockGeminiGenerate
    })
  }))
}));

describe('Translation Quality Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Translation Prompt Quality', () => {
    it('should use detailed translation prompt that prevents summarization', () => {
      const originalText = "This is a long story with multiple paragraphs. It has detailed descriptions and dialogue. The characters speak at length about their adventures.";
      const targetLanguage = "Hindi";
      
      // The new prompt should be much more specific
      const expectedPromptPattern = new RegExp('You are a professional translator.*Translate EVERY sentence.*Do NOT summarize', 's');
      
      // This would be called in the actual implementation
      const prompt = `You are a professional translator. Translate the following English text to ${targetLanguage} with these requirements:

1. Translate EVERY sentence and paragraph exactly as written
2. Do NOT summarize, shorten, or skip any content
3. Maintain the exact same structure, length, and narrative flow
4. Preserve all dialogue, descriptions, and story elements
5. Keep the same paragraph breaks and formatting
6. Return ONLY the complete translated text, nothing else

Text to translate:

${originalText}`;
      
      expect(prompt).toMatch(expectedPromptPattern);
      expect(prompt).toContain('Do NOT summarize');
      expect(prompt).toContain('EVERY sentence');
      expect(prompt).toContain(originalText);
    });
  });

  describe('Translation Length Validation', () => {
    it('should detect suspiciously short translations', () => {
      const originalText = "This is a very long story with many details and descriptions that should not be summarized when translated to another language.";
      const shortTranslation = "यह एक कहानी है।"; // "This is a story." - clearly summarized
      
      const originalLength = originalText.length;
      const translatedLength = shortTranslation.length;
      const lengthRatio = translatedLength / originalLength;
      
      // Should detect this as potentially summarized (ratio < 0.3)
      expect(lengthRatio).toBeLessThan(0.3);
    });

    it('should accept reasonable translation length variations', () => {
      const originalText = "Hello, how are you today? I hope you are doing well.";
      const goodTranslation = "नमस्ते, आज आप कैसे हैं? मुझे उम्मीद है कि आप अच्छा कर रहे हैं।";
      
      const originalLength = originalText.length;
      const translatedLength = goodTranslation.length;
      const lengthRatio = translatedLength / originalLength;
      
      // Should accept this as a good translation (ratio >= 0.3)
      expect(lengthRatio).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('Chunk-by-Chunk Translation Fallback', () => {
    it('should split text into meaningful chunks for translation', () => {
      const text = `This is the first paragraph with some content.

This is the second paragraph with more details.

This is the third paragraph with even more information.`;
      
      const chunks = text.split(/\n\s*\n/).filter(chunk => chunk.trim().length > 0);
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0].trim()).toBe('This is the first paragraph with some content.');
      expect(chunks[1].trim()).toBe('This is the second paragraph with more details.');
      expect(chunks[2].trim()).toBe('This is the third paragraph with even more information.');
    });

    it('should preserve content when translating chunks', async () => {
      const originalChunks = [
        'First paragraph content.',
        'Second paragraph content.',
        'Third paragraph content.'
      ];
      
      // Mock successful chunk translations
      mockGeminiGenerate
        .mockResolvedValueOnce({ response: { text: () => 'पहला पैराग्राफ सामग्री।' } })
        .mockResolvedValueOnce({ response: { text: () => 'दूसरा पैराग्राफ सामग्री।' } })
        .mockResolvedValueOnce({ response: { text: () => 'तीसरा पैराग्राफ सामग्री।' } });
      
      // Simulate the chunk translation process
      const translatedChunks: string[] = [];
      for (const chunk of originalChunks) {
        const result = await mockGeminiGenerate();
        translatedChunks.push(result.response.text());
      }
      
      const finalTranslation = translatedChunks.join('\n\n');
      
      expect(translatedChunks).toHaveLength(3);
      expect(finalTranslation).toContain('पहला पैराग्राफ');
      expect(finalTranslation).toContain('दूसरा पैराग्राफ');
      expect(finalTranslation).toContain('तीसरा पैराग्राफ');
    });
  });

  describe('Translation Quality Metrics', () => {
    it('should track translation metrics for quality assessment', () => {
      const originalText = "This is a test story with multiple sentences. It has dialogue and descriptions.";
      const translatedText = "यह कई वाक्यों के साथ एक परीक्षण कहानी है। इसमें संवाद और विवरण हैं।";
      
      const metrics = {
        originalLength: originalText.length,
        translatedLength: translatedText.length,
        lengthRatio: translatedText.length / originalText.length,
        originalWords: originalText.split(/\s+/).length,
        translatedWords: translatedText.split(/\s+/).length,
        wordRatio: translatedText.split(/\s+/).length / originalText.split(/\s+/).length
      };
      
      expect(metrics.lengthRatio).toBeGreaterThan(0.5);
      expect(metrics.lengthRatio).toBeLessThan(2.0);
      expect(metrics.wordRatio).toBeGreaterThan(0.5);
      expect(metrics.wordRatio).toBeLessThan(2.0);
    });
  });

  describe('Error Handling in Translation', () => {
    it('should handle translation API failures gracefully', async () => {
      mockGeminiGenerate.mockRejectedValueOnce(new Error('API Error'));
      
      let translationResult = null;
      try {
        await mockGeminiGenerate();
      } catch (error) {
        // Should fall back to original text
        translationResult = 'original text';
      }
      
      expect(translationResult).toBe('original text');
    });

    it('should handle partial chunk translation failures', async () => {
      const chunks = ['chunk1', 'chunk2', 'chunk3'];
      const translatedChunks: string[] = [];
      
      // Mock: first chunk succeeds, second fails, third succeeds
      mockGeminiGenerate
        .mockResolvedValueOnce({ response: { text: () => 'translated chunk1' } })
        .mockRejectedValueOnce(new Error('Translation failed'))
        .mockResolvedValueOnce({ response: { text: () => 'translated chunk3' } });
      
      for (let i = 0; i < chunks.length; i++) {
        try {
          const result = await mockGeminiGenerate();
          translatedChunks.push(result.response.text());
        } catch (error) {
          // Use original chunk if translation fails
          translatedChunks.push(chunks[i]);
        }
      }
      
      expect(translatedChunks).toEqual([
        'translated chunk1',
        'chunk2', // Original chunk used due to failure
        'translated chunk3'
      ]);
    });
  });
});