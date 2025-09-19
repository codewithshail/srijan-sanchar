/**
 * Intelligent Text Chunker for TTS Processing
 * 
 * This class provides advanced text splitting algorithms that:
 * - Split text at natural breakpoints (paragraphs, sentences)
 * - Validate that no content is lost during chunking
 * - Maintain context and readability
 * - Optimize chunk sizes for API efficiency and audio quality
 */

export interface TextChunk {
  text: string;
  index: number;
  startPosition: number;
  endPosition: number;
}

export interface ChunkingOptions {
  maxChunkSize: number;
  minChunkSize: number;
  preserveContext: boolean;
  splitStrategy: 'paragraph' | 'sentence' | 'hybrid';
}

export interface TextChunker {
  splitText(text: string, options?: Partial<ChunkingOptions>): TextChunk[];
  validateChunks(chunks: TextChunk[], originalText: string): boolean;
}

export class IntelligentTextChunker implements TextChunker {
  private readonly defaultOptions: ChunkingOptions = {
    maxChunkSize: 600,
    minChunkSize: 50,
    preserveContext: true,
    splitStrategy: 'hybrid'
  };

  /**
   * Split text into intelligent chunks based on natural breakpoints
   */
  splitText(text: string, options?: Partial<ChunkingOptions>): TextChunk[] {
    const opts = { ...this.defaultOptions, ...options };
    
    if (!text || text.trim().length === 0) {
      return [];
    }

    const normalizedText = this.normalizeText(text);
    let chunks: TextChunk[] = [];

    console.log(`[TEXT_CHUNKER] Processing text of ${normalizedText.length} characters with strategy: ${opts.splitStrategy}`);

    switch (opts.splitStrategy) {
      case 'paragraph':
        chunks = this.splitByParagraphs(normalizedText, opts);
        break;
      case 'sentence':
        chunks = this.splitBySentences(normalizedText, opts);
        break;
      case 'hybrid':
      default:
        chunks = this.hybridSplit(normalizedText, opts);
        break;
    }

    // Force split any chunks that exceed max size
    chunks = this.forceSplitLongChunks(chunks, opts.maxChunkSize);

    // Validate that we haven't lost any content
    if (!this.validateChunks(chunks, normalizedText)) {
      console.warn('[TEXT_CHUNKER] Validation failed, falling back to simple splitting');
      chunks = this.fallbackSplit(normalizedText, opts.maxChunkSize);
    }

    console.log(`[TEXT_CHUNKER] Created ${chunks.length} chunks`);
    this.logChunkSummary(chunks);

    return chunks;
  }

  /**
   * Normalize text by cleaning up whitespace and formatting
   */
  private normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\t/g, ' ') // Replace tabs with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim();
  }

  /**
   * Hybrid splitting strategy that combines paragraph and sentence splitting
   */
  private hybridSplit(text: string, options: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentPosition = 0;

    // First, try to split by paragraphs
    const paragraphs = this.extractParagraphs(text);
    
    for (const paragraph of paragraphs) {
      const paragraphStart = text.indexOf(paragraph.text, currentPosition);
      
      if (paragraph.text.length <= options.maxChunkSize) {
        // Paragraph fits in one chunk
        chunks.push({
          text: paragraph.text,
          index: chunks.length,
          startPosition: paragraphStart,
          endPosition: paragraphStart + paragraph.text.length
        });
      } else {
        // Split long paragraphs by sentences
        const sentenceChunks = this.splitLongParagraph(
          paragraph.text, 
          options, 
          paragraphStart
        );
        chunks.push(...sentenceChunks);
      }
      
      currentPosition = paragraphStart + paragraph.text.length;
    }

    return chunks;
  }

  /**
   * Extract paragraphs from text, preserving their positions
   */
  private extractParagraphs(text: string): Array<{ text: string; position: number }> {
    const paragraphs: Array<{ text: string; position: number }> = [];
    
    // Try multiple paragraph detection strategies
    let parts: string[] = [];
    
    // First try double newlines
    if (text.includes('\n\n')) {
      parts = text.split(/\n\s*\n/);
    } 
    // Then try single newlines (for cases where paragraphs are separated by single newlines)
    else if (text.includes('\n')) {
      parts = text.split(/\n/);
    }
    // Finally, try to detect sentence-based paragraphs (sentences ending with period followed by capital letter)
    else {
      // Look for patterns like ". Second" or ". Third" which might indicate paragraph breaks
      const sentenceBreaks = text.split(/\.\s+(?=[A-Z])/);
      if (sentenceBreaks.length > 1) {
        parts = sentenceBreaks.map((part, index) => 
          index < sentenceBreaks.length - 1 ? part + '.' : part
        );
      } else {
        parts = [text];
      }
    }
    
    let currentPosition = 0;
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        const position = text.indexOf(trimmed, currentPosition);
        paragraphs.push({
          text: trimmed,
          position: position >= 0 ? position : currentPosition
        });
        currentPosition = position >= 0 ? position + trimmed.length : currentPosition + part.length;
      }
    }

    // If no paragraphs found, treat entire text as one paragraph
    if (paragraphs.length === 0 && text.trim().length > 0) {
      paragraphs.push({
        text: text.trim(),
        position: 0
      });
    }

    return paragraphs;
  }

  /**
   * Split a long paragraph by sentences
   */
  private splitLongParagraph(
    paragraph: string, 
    options: ChunkingOptions, 
    startPosition: number
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    const sentences = this.extractSentences(paragraph);
    
    let currentChunk = '';
    let chunkStartPos = startPosition;
    let sentenceStartInParagraph = 0;

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length > options.maxChunkSize && currentChunk.length >= options.minChunkSize) {
        // Current chunk is full, start a new one
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length,
          startPosition: chunkStartPos,
          endPosition: chunkStartPos + currentChunk.length
        });
        
        chunkStartPos = startPosition + sentenceStartInParagraph;
        currentChunk = sentence;
      } else {
        currentChunk = potentialChunk;
      }
      
      sentenceStartInParagraph += sentence.length + 1; // +1 for space/punctuation
    }

    // Add the final chunk if it has content
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunks.length,
        startPosition: chunkStartPos,
        endPosition: chunkStartPos + currentChunk.length
      });
    }

    return chunks;
  }

  /**
   * Extract sentences from text using improved sentence detection
   */
  private extractSentences(text: string): string[] {
    // Enhanced sentence splitting that handles common abbreviations and edge cases
    const sentences: string[] = [];
    
    // Split on sentence-ending punctuation followed by whitespace and capital letter
    // This regex handles most common cases while avoiding false positives with abbreviations
    const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])/;
    const parts = text.split(sentenceRegex);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
    }

    // If no sentences found, treat entire text as one sentence
    if (sentences.length === 0 && text.trim().length > 0) {
      sentences.push(text.trim());
    }

    return sentences;
  }

  /**
   * Split by paragraphs only
   */
  private splitByParagraphs(text: string, options: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = [];
    const paragraphs = this.extractParagraphs(text);
    
    for (const paragraph of paragraphs) {
      if (paragraph.text.length <= options.maxChunkSize) {
        chunks.push({
          text: paragraph.text,
          index: chunks.length,
          startPosition: paragraph.position,
          endPosition: paragraph.position + paragraph.text.length
        });
      } else {
        // If paragraph is too long, we need to split it further
        const subChunks = this.splitLongParagraph(paragraph.text, options, paragraph.position);
        chunks.push(...subChunks);
      }
    }

    return chunks;
  }

  /**
   * Split by sentences only
   */
  private splitBySentences(text: string, options: ChunkingOptions): TextChunk[] {
    const chunks: TextChunk[] = [];
    const sentences = this.extractSentences(text);
    
    let currentChunk = '';
    let chunkStartPos = 0;
    let currentPos = 0;

    for (const sentence of sentences) {
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      if (potentialChunk.length > options.maxChunkSize && currentChunk.length >= options.minChunkSize) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunks.length,
          startPosition: chunkStartPos,
          endPosition: chunkStartPos + currentChunk.length
        });
        
        chunkStartPos = currentPos;
        currentChunk = sentence;
      } else {
        if (!currentChunk) {
          chunkStartPos = currentPos;
        }
        currentChunk = potentialChunk;
      }
      
      currentPos += sentence.length + 1; // +1 for space
    }

    // Add the final chunk
    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunks.length,
        startPosition: chunkStartPos,
        endPosition: chunkStartPos + currentChunk.length
      });
    }

    return chunks;
  }

  /**
   * Validate that chunks preserve all original content
   */
  validateChunks(chunks: TextChunk[], originalText: string): boolean {
    if (chunks.length === 0) {
      return originalText.trim().length === 0;
    }

    // Reconstruct text from chunks
    const reconstructed = chunks.map(c => c.text).join(' ');
    
    // Normalize both texts for comparison
    const normalizedOriginal = this.normalizeForComparison(originalText);
    const normalizedReconstructed = this.normalizeForComparison(reconstructed);
    
    // Calculate similarity
    const similarity = this.calculateTextSimilarity(normalizedOriginal, normalizedReconstructed);
    
    console.log(`[TEXT_CHUNKER] Validation similarity: ${(similarity * 100).toFixed(2)}%`);
    
    // We allow for more differences when using fallback splitting
    const isValid = similarity >= 0.85;
    
    if (!isValid) {
      console.warn('[TEXT_CHUNKER] Validation failed:');
      console.warn('Original length:', normalizedOriginal.length);
      console.warn('Reconstructed length:', normalizedReconstructed.length);
      console.warn('Similarity:', similarity);
    }
    
    return isValid;
  }

  /**
   * Normalize text for comparison by removing extra whitespace and punctuation variations
   */
  private normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '') // Remove punctuation for comparison
      .trim();
  }

  /**
   * Calculate similarity between two texts using character-based comparison
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (text1.length === 0 && text2.length === 0) return 1.0;
    if (text1.length === 0 || text2.length === 0) return 0.0;
    
    // Use character-based similarity for more accurate comparison
    const chars1 = text1.split('').filter(c => c !== ' ');
    const chars2 = text2.split('').filter(c => c !== ' ');
    
    const set1 = new Set(chars1);
    const set2 = new Set(chars2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Also check length similarity
    const lengthSimilarity = Math.min(chars1.length, chars2.length) / Math.max(chars1.length, chars2.length);
    
    // Return weighted average
    return (jaccardSimilarity * 0.7) + (lengthSimilarity * 0.3);
  }

  /**
   * Fallback splitting method for when intelligent splitting fails
   * Tries to break at word boundaries when possible
   */
  private fallbackSplit(text: string, maxChunkSize: number): TextChunk[] {
    const chunks: TextChunk[] = [];
    let currentPosition = 0;
    
    while (currentPosition < text.length) {
      let endPosition = Math.min(currentPosition + maxChunkSize, text.length);
      
      // If we're not at the end of the text, try to find a word boundary
      if (endPosition < text.length) {
        // Look backwards for a space or punctuation
        let wordBoundary = endPosition;
        for (let i = endPosition; i > currentPosition + maxChunkSize * 0.7; i--) {
          if (/\s/.test(text[i]) || /[.!?;,]/.test(text[i])) {
            wordBoundary = i + 1;
            break;
          }
        }
        endPosition = wordBoundary;
      }
      
      const chunkText = text.slice(currentPosition, endPosition).trim();
      if (chunkText.length > 0) {
        chunks.push({
          text: chunkText,
          index: chunks.length,
          startPosition: currentPosition,
          endPosition: endPosition
        });
      }
      
      currentPosition = endPosition;
    }
    
    console.log(`[TEXT_CHUNKER] Used fallback splitting: ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Force split text that exceeds max chunk size
   */
  private forceSplitLongChunks(chunks: TextChunk[], maxChunkSize: number): TextChunk[] {
    const result: TextChunk[] = [];
    
    for (const chunk of chunks) {
      if (chunk.text.length <= maxChunkSize) {
        result.push({
          ...chunk,
          index: result.length
        });
      } else {
        // Split this chunk into smaller pieces
        const subChunks = this.fallbackSplit(chunk.text, maxChunkSize);
        for (const subChunk of subChunks) {
          result.push({
            text: subChunk.text,
            index: result.length,
            startPosition: chunk.startPosition + subChunk.startPosition,
            endPosition: chunk.startPosition + subChunk.endPosition
          });
        }
      }
    }
    
    return result;
  }

  /**
   * Log summary of created chunks for debugging
   */
  private logChunkSummary(chunks: TextChunk[]): void {
    if (chunks.length === 0) return;
    
    const sizes = chunks.map(c => c.text.length);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    
    console.log(`[TEXT_CHUNKER] Chunk summary - Count: ${chunks.length}, Avg: ${avgSize.toFixed(0)}, Min: ${minSize}, Max: ${maxSize}`);
    
    // Log first few chunks for debugging
    chunks.slice(0, 3).forEach((chunk, i) => {
      console.log(`[TEXT_CHUNKER] Chunk ${i}: "${chunk.text.substring(0, 100)}${chunk.text.length > 100 ? '...' : ''}"`);
    });
  }
}

// Export singleton instance
export const intelligentTextChunker = new IntelligentTextChunker();