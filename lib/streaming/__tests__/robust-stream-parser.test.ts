import { describe, it, expect, beforeEach } from 'vitest';
import { RobustStreamParser, createRobustStreamParser, type ParsedData } from '../robust-stream-parser';

describe('RobustStreamParser', () => {
  let parser: RobustStreamParser;

  beforeEach(() => {
    parser = createRobustStreamParser();
  });

  describe('Basic JSON Parsing', () => {
    it('should parse complete JSON chunks correctly', () => {
      const chunk = 'data: {"type":"audio_chunk","data":"abc123","index":0,"total":1}\n';
      const results = parser.parseChunk(chunk);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: 'audio_chunk',
        data: 'abc123',
        index: 0,
        total: 1
      });
    });

    it('should parse multiple complete JSON chunks in one call', () => {
      const chunk = 'data: {"type":"audio_chunk","index":0}\n' +
                   'data: {"type":"audio_chunk","index":1}\n';
      const results = parser.parseChunk(chunk);

      expect(results).toHaveLength(2);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
    });

    it('should skip empty lines and whitespace', () => {
      const chunk = '\n\n  \n' +
                   'data: {"type":"complete"}\n' +
                   '\n  \n';
      const results = parser.parseChunk(chunk);

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('complete');
    });
  });

  describe('Incomplete JSON Handling', () => {
    it('should handle incomplete JSON chunks by buffering', () => {
      const chunk1 = 'data: {"type":"audio_chunk","data":"abc';
      const chunk2 = 'def","index":0}\n';

      const results1 = parser.parseChunk(chunk1);
      expect(results1).toHaveLength(0);
      expect(parser.hasBufferedData()).toBe(true);

      const results2 = parser.parseChunk(chunk2);
      expect(results2).toHaveLength(1);
      expect(results2[0].data).toBe('abcdef');
      expect(parser.hasBufferedData()).toBe(false);
    });

    it('should handle JSON split across multiple chunks', () => {
      const chunk1 = 'data: {"type":"audio_chunk_part",';
      const chunk2 = '"data":"longbase64string",';
      const chunk3 = '"index":0,"part":1,"isLastPart":true}\n';

      parser.parseChunk(chunk1);
      expect(parser.hasBufferedData()).toBe(true);

      parser.parseChunk(chunk2);
      expect(parser.hasBufferedData()).toBe(true);

      const results = parser.parseChunk(chunk3);
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: 'audio_chunk_part',
        data: 'longbase64string',
        index: 0,
        part: 1,
        isLastPart: true
      });
      expect(parser.hasBufferedData()).toBe(false);
    });

    it('should handle incomplete lines without data prefix', () => {
      const chunk1 = 'some incomplete line without data prefix';
      const chunk2 = '\ndata: {"type":"complete"}\n';

      parser.parseChunk(chunk1);
      expect(parser.hasBufferedData()).toBe(true);

      const results = parser.parseChunk(chunk2);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('complete');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully without breaking stream', () => {
      const chunk = 'data: {"type":"audio_chunk","malformed":}\n' +
                   'data: {"type":"complete"}\n';

      const results = parser.parseChunk(chunk);
      
      // Should skip malformed JSON but continue processing
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('complete');
    });

    it('should handle invalid data structures', () => {
      const chunk = 'data: "just a string"\n' +
                   'data: {"type":"complete"}\n';

      const results = parser.parseChunk(chunk);
      
      // Should skip invalid structure but continue processing
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('complete');
    });

    it('should handle null and undefined JSON', () => {
      const chunk = 'data: null\n' +
                   'data: undefined\n' +
                   'data: {"type":"complete"}\n';

      const results = parser.parseChunk(chunk);
      
      // Should skip null/undefined but continue processing
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('complete');
    });

    it('should continue processing after JSON syntax errors', () => {
      const chunk = 'data: {"unclosed": "string\n' +
                   'data: {"type":"audio_chunk","index":0}\n' +
                   'data: {"another": malformed}\n' +
                   'data: {"type":"complete"}\n';

      const results = parser.parseChunk(chunk);
      
      // Should parse valid JSON and skip malformed ones
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('audio_chunk');
      expect(results[1].type).toBe('complete');
    });
  });

  describe('Large Data Handling', () => {
    it('should handle large base64 chunks split across multiple parts', () => {
      const largeData = 'a'.repeat(100000); // 100KB of data
      const chunk = `data: {"type":"audio_chunk","data":"${largeData}","index":0}\n`;

      const results = parser.parseChunk(chunk);
      
      expect(results).toHaveLength(1);
      expect(results[0].data).toBe(largeData);
      expect(results[0].type).toBe('audio_chunk');
    });

    it('should handle multiple large chunks in sequence', () => {
      const largeData1 = 'a'.repeat(50000);
      const largeData2 = 'b'.repeat(50000);
      
      const chunk = `data: {"type":"audio_chunk","data":"${largeData1}","index":0}\n` +
                   `data: {"type":"audio_chunk","data":"${largeData2}","index":1}\n`;

      const results = parser.parseChunk(chunk);
      
      expect(results).toHaveLength(2);
      expect(results[0].data).toBe(largeData1);
      expect(results[1].data).toBe(largeData2);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical audio streaming response format', () => {
      const chunk = 'data: {"type":"audio_chunk_part","data":"UklGRiQAAABXQVZF","index":0,"part":0,"totalParts":3,"isLastPart":false}\n' +
                   'data: {"type":"audio_chunk_part","data":"Zm10IBAAAAABAAEAK","index":0,"part":1,"totalParts":3,"isLastPart":false}\n' +
                   'data: {"type":"audio_chunk_part","data":"ZGF0YQAAAAA=","index":0,"part":2,"totalParts":3,"isLastPart":true}\n';

      const results = parser.parseChunk(chunk);
      
      expect(results).toHaveLength(3);
      expect(results[0].type).toBe('audio_chunk_part');
      expect(results[0].part).toBe(0);
      expect(results[0].isLastPart).toBe(false);
      expect(results[2].isLastPart).toBe(true);
    });

    it('should handle error responses in stream', () => {
      const chunk = 'data: {"type":"audio_chunk","data":"abc","index":0}\n' +
                   'data: {"type":"error","message":"API rate limit exceeded"}\n';

      const results = parser.parseChunk(chunk);
      
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('audio_chunk');
      expect(results[1].type).toBe('error');
      expect(results[1].message).toBe('API rate limit exceeded');
    });

    it('should handle completion signal', () => {
      const chunk = 'data: {"type":"audio_chunk","data":"final","index":2,"total":3}\n' +
                   'data: {"type":"complete"}\n';

      const results = parser.parseChunk(chunk);
      
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('audio_chunk');
      expect(results[1].type).toBe('complete');
    });
  });

  describe('Parser State Management', () => {
    it('should reset parser state correctly', () => {
      parser.parseChunk('data: {"incomplete": "json');
      expect(parser.hasBufferedData()).toBe(true);

      parser.reset();
      expect(parser.hasBufferedData()).toBe(false);
      expect(parser.getBuffer()).toBe('');
    });

    it('should provide accurate buffer statistics', () => {
      const stats1 = parser.getStats();
      expect(stats1.bufferSize).toBe(0);
      expect(stats1.hasData).toBe(false);

      parser.parseChunk('data: {"incomplete": "json');
      const stats2 = parser.getStats();
      expect(stats2.bufferSize).toBeGreaterThan(0);
      expect(stats2.hasData).toBe(true);
    });

    it('should handle consecutive incomplete and complete chunks', () => {
      // First incomplete chunk
      parser.parseChunk('data: {"type":"audio_chunk","data":"part1');
      expect(parser.hasBufferedData()).toBe(true);

      // Complete the chunk and add another incomplete one
      const results1 = parser.parseChunk('part2","index":0}\ndata: {"type":"complete"');
      expect(results1).toHaveLength(1);
      expect(results1[0].data).toBe('part1part2');
      expect(parser.hasBufferedData()).toBe(true);

      // Complete the second chunk
      const results2 = parser.parseChunk('}\n');
      expect(results2).toHaveLength(1);
      expect(results2[0].type).toBe('complete');
      expect(parser.hasBufferedData()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty chunks', () => {
      const results = parser.parseChunk('');
      expect(results).toHaveLength(0);
      expect(parser.hasBufferedData()).toBe(false);
    });

    it('should handle chunks with only whitespace', () => {
      const results = parser.parseChunk('   \n  \n  ');
      expect(results).toHaveLength(0);
      expect(parser.hasBufferedData()).toBe(false);
    });

    it('should handle chunks without data prefix', () => {
      const chunk = 'some random text\nmore random text\n';
      const results = parser.parseChunk(chunk);
      expect(results).toHaveLength(0);
    });

    it('should handle mixed valid and invalid lines', () => {
      const chunk = 'random line\n' +
                   'data: {"type":"audio_chunk","index":0}\n' +
                   'another random line\n' +
                   'data: {"type":"complete"}\n';

      const results = parser.parseChunk(chunk);
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('audio_chunk');
      expect(results[1].type).toBe('complete');
    });
  });
});