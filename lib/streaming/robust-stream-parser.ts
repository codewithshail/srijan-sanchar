/**
 * Robust JSON Stream Parser
 * 
 * Handles incomplete JSON chunks by maintaining a buffer and properly parsing
 * Server-Sent Events (SSE) formatted streams. Addresses the "Unterminated string in JSON"
 * errors that occur when JSON data is split across multiple chunks.
 */

export interface ParsedData {
  type: 'audio_chunk' | 'audio_chunk_part' | 'complete' | 'error';
  data?: string;
  index?: number;
  total?: number;
  part?: number;
  totalParts?: number;
  isLastPart?: boolean;
  message?: string;
}

export interface StreamParser {
  parseChunk(chunk: string): ParsedData[];
  getBuffer(): string;
  reset(): void;
  hasBufferedData(): boolean;
}

export class RobustStreamParser implements StreamParser {
  private buffer: string = '';
  private lineBuffer: string = '';

  /**
   * Parse a chunk of streaming data, handling incomplete JSON gracefully
   * @param chunk Raw chunk data from the stream
   * @returns Array of successfully parsed data objects
   */
  parseChunk(chunk: string): ParsedData[] {
    // Add chunk to buffer
    this.buffer += chunk;
    
    const results: ParsedData[] = [];
    
    // Split by lines, but keep incomplete lines in buffer
    const lines = this.buffer.split('\n');
    
    // If buffer doesn't end with newline, keep the last line for next chunk
    if (!this.buffer.endsWith('\n')) {
      this.buffer = lines.pop() || '';
    } else {
      this.buffer = '';
    }
    
    // Process complete lines
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }
      
      // Handle SSE format: "data: {json}"
      if (trimmedLine.startsWith('data: ')) {
        const jsonStr = trimmedLine.slice(6).trim();
        
        if (jsonStr) {
          const parsed = this.safeParseJSON(jsonStr);
          if (parsed) {
            results.push(parsed);
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Safely parse JSON with error handling and logging
   * @param jsonStr JSON string to parse
   * @returns Parsed data object or null if parsing fails
   */
  private safeParseJSON(jsonStr: string): ParsedData | null {
    try {
      const data = JSON.parse(jsonStr);
      
      // Validate that it's a proper data object
      if (typeof data === 'object' && data !== null && 'type' in data) {
        return data as ParsedData;
      } else {
        console.warn('[ROBUST_PARSER] Invalid data structure:', data);
        return null;
      }
    } catch (error) {
      // Log parsing errors for debugging, but don't break the stream
      if (error instanceof SyntaxError) {
        console.warn('[ROBUST_PARSER] JSON parse error:', {
          error: error.message,
          jsonPreview: jsonStr.substring(0, 100) + (jsonStr.length > 100 ? '...' : ''),
          jsonLength: jsonStr.length
        });
      } else {
        console.warn('[ROBUST_PARSER] Unexpected parsing error:', error);
      }
      return null;
    }
  }

  /**
   * Get the current buffer content (for debugging)
   * @returns Current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Check if there's buffered data waiting to be processed
   * @returns True if buffer contains data
   */
  hasBufferedData(): boolean {
    return this.buffer.trim().length > 0;
  }

  /**
   * Reset the parser state
   */
  reset(): void {
    this.buffer = '';
    this.lineBuffer = '';
  }

  /**
   * Get parser statistics for debugging
   * @returns Parser state information
   */
  getStats(): { bufferSize: number; hasData: boolean } {
    return {
      bufferSize: this.buffer.length,
      hasData: this.hasBufferedData()
    };
  }
}

/**
 * Factory function to create a new robust stream parser
 * @returns New RobustStreamParser instance
 */
export function createRobustStreamParser(): RobustStreamParser {
  return new RobustStreamParser();
}