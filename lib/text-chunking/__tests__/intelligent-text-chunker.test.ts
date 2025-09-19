import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligentTextChunker, TextChunk, ChunkingOptions } from '../intelligent-text-chunker';

describe('IntelligentTextChunker', () => {
  let chunker: IntelligentTextChunker;

  beforeEach(() => {
    chunker = new IntelligentTextChunker();
  });

  describe('Basic Functionality', () => {
    it('should handle empty text', () => {
      const chunks = chunker.splitText('');
      expect(chunks).toHaveLength(0);
    });

    it('should handle whitespace-only text', () => {
      const chunks = chunker.splitText('   \n\t  ');
      expect(chunks).toHaveLength(0);
    });

    it('should handle single short sentence', () => {
      const text = 'This is a short sentence.';
      const chunks = chunker.splitText(text);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].startPosition).toBe(0);
      expect(chunks[0].endPosition).toBe(text.length);
    });
  });

  describe('Content Validation', () => {
    it('should not lose content when chunking', () => {
      const text = "This is the first sentence. This is the second sentence. This is the third sentence with more content to make it longer.";
      const chunks = chunker.splitText(text, { maxChunkSize: 50 });
      
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });

    it('should preserve content across multiple paragraphs', () => {
      const text = `First paragraph with some content here.

Second paragraph with different content.

Third paragraph with even more content to test the chunking algorithm.`;
      
      const chunks = chunker.splitText(text);
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });

    it('should handle text with special characters and punctuation', () => {
      const text = "Hello! How are you? I'm fine, thanks. What about you?";
      const chunks = chunker.splitText(text, { maxChunkSize: 30 });
      
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });
  });

  describe('Paragraph-based Splitting', () => {
    it('should split by paragraphs when they fit within chunk size', () => {
      const text = `First paragraph.

Second paragraph.

Third paragraph.`;
      
      const chunks = chunker.splitText(text, { 
        maxChunkSize: 100,
        splitStrategy: 'paragraph' 
      });
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0].text).toBe('First paragraph.');
      expect(chunks[1].text).toBe('Second paragraph.');
      expect(chunks[2].text).toBe('Third paragraph.');
    });

    it('should split long paragraphs into smaller chunks', () => {
      const longParagraph = 'This is a very long paragraph that contains multiple sentences. ' +
        'It should be split into smaller chunks when it exceeds the maximum chunk size. ' +
        'Each chunk should maintain readability and context.';
      
      const chunks = chunker.splitText(longParagraph, { 
        maxChunkSize: 80,
        splitStrategy: 'paragraph' 
      });
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(80);
      });
    });
  });

  describe('Sentence-based Splitting', () => {
    it('should split by sentences', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const chunks = chunker.splitText(text, { 
        maxChunkSize: 20,
        splitStrategy: 'sentence' 
      });
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });

    it('should handle sentences with abbreviations', () => {
      const text = 'Dr. Smith went to the U.S.A. He had a great time.';
      const chunks = chunker.splitText(text, { 
        maxChunkSize: 30,
        splitStrategy: 'sentence' 
      });
      
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });
  });

  describe('Hybrid Splitting Strategy', () => {
    it('should use hybrid strategy by default', () => {
      const text = `First paragraph with a sentence.

Second paragraph with multiple sentences. This is another sentence. And one more.`;
      
      const chunks = chunker.splitText(text, { maxChunkSize: 50 });
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });

    it('should handle mixed content with paragraphs and long sentences', () => {
      const text = `Short paragraph.

This is a much longer paragraph that contains several sentences and should be split appropriately. It has enough content to require multiple chunks. The algorithm should handle this gracefully.

Another short paragraph.`;
      
      const chunks = chunker.splitText(text, { maxChunkSize: 100 });
      
      expect(chunks.length).toBeGreaterThan(2);
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });
  });

  describe('Chunk Size Constraints', () => {
    it('should respect maximum chunk size', () => {
      const longText = 'A'.repeat(1000);
      const chunks = chunker.splitText(longText, { maxChunkSize: 100 });
      
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(100);
      });
    });

    it('should respect minimum chunk size when possible', () => {
      const text = 'This is a longer sentence that should meet minimum requirements. Another sentence here. And one more sentence to test.';
      const chunks = chunker.splitText(text, { 
        maxChunkSize: 80,
        minChunkSize: 20 
      });
      
      // Most chunks should meet minimum size (except possibly the last one)
      const chunksAboveMin = chunks.filter(c => c.text.length >= 20);
      expect(chunksAboveMin.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with only punctuation', () => {
      const text = '!!! ??? ... --- +++';
      const chunks = chunker.splitText(text);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });

    it('should handle text with numbers and special characters', () => {
      const text = 'The price is $19.99. Call 1-800-555-0123 for more info.';
      const chunks = chunker.splitText(text);
      
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });

    it('should handle very long single sentence', () => {
      const longSentence = 'This is an extremely long sentence that goes on and on without any natural breaking points and should still be handled gracefully by the chunking algorithm even though it exceeds the normal chunk size limits.';
      
      const chunks = chunker.splitText(longSentence, { maxChunkSize: 50 });
      
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunker.validateChunks(chunks, longSentence)).toBe(true);
    });

    it('should handle text with mixed line endings', () => {
      const text = 'Line 1\nLine 2\r\nLine 3\rLine 4';
      const chunks = chunker.splitText(text);
      
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });
  });

  describe('Chunk Metadata', () => {
    it('should provide correct chunk indices', () => {
      const text = 'First. Second. Third. Fourth.';
      const chunks = chunker.splitText(text, { maxChunkSize: 10 });
      
      chunks.forEach((chunk, index) => {
        expect(chunk.index).toBe(index);
      });
    });

    it('should provide reasonable position information', () => {
      const text = 'First sentence. Second sentence.';
      const chunks = chunker.splitText(text, { maxChunkSize: 20 });
      
      chunks.forEach(chunk => {
        expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
        expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
        expect(chunk.endPosition).toBeLessThanOrEqual(text.length);
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle large text efficiently', () => {
      const largeText = 'This is a sentence. '.repeat(1000);
      const startTime = Date.now();
      
      const chunks = chunker.splitText(largeText);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunker.validateChunks(chunks, largeText)).toBe(true);
    });

    it('should be consistent across multiple runs', () => {
      const text = 'Consistent text for testing. Should produce same results.';
      
      const chunks1 = chunker.splitText(text);
      const chunks2 = chunker.splitText(text);
      
      expect(chunks1).toEqual(chunks2);
    });
  });

  describe('Custom Options', () => {
    it('should respect custom chunking options', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const options: Partial<ChunkingOptions> = {
        maxChunkSize: 25,
        minChunkSize: 10,
        splitStrategy: 'sentence'
      };
      
      const chunks = chunker.splitText(text, options);
      
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(25);
      });
      expect(chunker.validateChunks(chunks, text)).toBe(true);
    });
  });
});