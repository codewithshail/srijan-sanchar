/**
 * WAV Audio Chunk Manager
 *
 * Handles proper concatenation of multiple WAV audio files by parsing headers,
 * extracting audio data, and creating a new combined WAV file with correct format.
 */

export interface AudioChunkManager {
  addChunk(audioData: ArrayBuffer, index: number): void;
  combineChunks(): ArrayBuffer;
  getProgress(): number;
  getTotalChunks(): number;
  getChunkCount(): number;
  getAllChunks(): ArrayBuffer[];
  reset(): void;
  validateChunk(audioData: ArrayBuffer): boolean;
}

export interface WAVHeader {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  audioDataSize: number;
  audioDataOffset: number;
}

export class WAVAudioChunkManager implements AudioChunkManager {
  private chunks: Map<number, ArrayBuffer> = new Map();
  private totalChunks: number = 0;
  private expectedFormat: WAVHeader | null = null;

  /**
   * Add an audio chunk at the specified index
   */
  addChunk(audioData: ArrayBuffer, index: number): void {
    if (!this.validateChunk(audioData)) {
      throw new Error(`Invalid WAV chunk at index ${index}`);
    }

    // Parse header to ensure consistency
    const header = this.parseWAVHeader(audioData);

    if (this.expectedFormat === null) {
      // First chunk - establish the format
      this.expectedFormat = header;
      console.log("[WAV_MANAGER] Established format:", header);
    } else {
      // Validate format consistency
      if (!this.isFormatCompatible(header, this.expectedFormat)) {
        console.warn(
          "[WAV_MANAGER] Format mismatch in chunk",
          index,
          "expected:",
          this.expectedFormat,
          "got:",
          header
        );
        // Continue processing but log the warning
      }
    }

    this.chunks.set(index, audioData);
    console.log(
      `[WAV_MANAGER] Added chunk ${index}, total chunks: ${this.chunks.size}`
    );
  }

  /**
   * Set the expected total number of chunks
   */
  setTotalChunks(total: number): void {
    this.totalChunks = total;
  }

  /**
   * Combine all chunks into a single WAV file
   */
  combineChunks(): ArrayBuffer {
    if (this.chunks.size === 0) {
      console.warn("[WAV_MANAGER] No chunks to combine");
      return new ArrayBuffer(0);
    }

    if (this.chunks.size === 1) {
      console.log("[WAV_MANAGER] Single chunk, returning as-is");
      const singleChunk = this.chunks.values().next().value;
      return singleChunk || new ArrayBuffer(0);
    }

    console.log(`[WAV_MANAGER] Combining ${this.chunks.size} chunks`);

    // Sort chunks by index to ensure correct order
    const sortedChunks = Array.from(this.chunks.entries())
      .sort(([a], [b]) => a - b)
      .map(([, buffer]) => buffer);

    return this.concatenateWAVFiles(sortedChunks);
  }

  /**
   * Get current progress as percentage
   */
  getProgress(): number {
    if (this.totalChunks === 0) return 0;
    return (this.chunks.size / this.totalChunks) * 100;
  }

  /**
   * Get total expected chunks
   */
  getTotalChunks(): number {
    return this.totalChunks;
  }

  /**
   * Get current chunk count
   */
  getChunkCount(): number {
    return this.chunks.size;
  }

  /**
   * Get all chunks as an ordered array
   */
  getAllChunks(): ArrayBuffer[] {
    // Sort chunks by index to ensure correct order
    return Array.from(this.chunks.entries())
      .sort(([a], [b]) => a - b)
      .map(([, buffer]) => buffer);
  }

  /**
   * Reset the manager state
   */
  reset(): void {
    this.chunks.clear();
    this.totalChunks = 0;
    this.expectedFormat = null;
    console.log("[WAV_MANAGER] Reset complete");
  }

  /**
   * Validate that the provided data is a valid WAV file
   */
  validateChunk(audioData: ArrayBuffer): boolean {
    if (audioData.byteLength < 44) {
      console.error("[WAV_MANAGER] Chunk too small to be valid WAV file");
      return false;
    }

    try {
      const header = this.parseWAVHeader(audioData);
      return (
        header.audioDataSize > 0 && header.sampleRate > 0 && header.channels > 0
      );
    } catch (error) {
      console.error("[WAV_MANAGER] Chunk validation failed:", error);
      return false;
    }
  }

  /**
   * Parse WAV file header to extract format information
   */
  private parseWAVHeader(buffer: ArrayBuffer): WAVHeader {
    const view = new DataView(buffer);

    // Check RIFF header
    const riffHeader = this.readString(view, 0, 4);
    if (riffHeader !== "RIFF") {
      throw new Error("Invalid WAV file: missing RIFF header");
    }

    // Check WAVE format
    const waveHeader = this.readString(view, 8, 4);
    if (waveHeader !== "WAVE") {
      throw new Error("Invalid WAV file: missing WAVE header");
    }

    // Find fmt chunk
    let offset = 12;
    while (offset < buffer.byteLength - 8) {
      const chunkId = this.readString(view, offset, 4);
      const chunkSize = view.getUint32(offset + 4, true);

      if (chunkId === "fmt ") {
        // Parse format chunk
        const audioFormat = view.getUint16(offset + 8, true);
        if (audioFormat !== 1) {
          throw new Error(
            `Unsupported audio format: ${audioFormat} (only PCM supported)`
          );
        }

        const channels = view.getUint16(offset + 10, true);
        const sampleRate = view.getUint32(offset + 12, true);
        const bitsPerSample = view.getUint16(offset + 22, true);

        // Find data chunk
        let dataOffset = offset + 8 + chunkSize;
        while (dataOffset < buffer.byteLength - 8) {
          const dataChunkId = this.readString(view, dataOffset, 4);
          const dataChunkSize = view.getUint32(dataOffset + 4, true);

          if (dataChunkId === "data") {
            return {
              sampleRate,
              channels,
              bitsPerSample,
              audioDataSize: dataChunkSize,
              audioDataOffset: dataOffset + 8,
            };
          }

          dataOffset += 8 + dataChunkSize;
        }

        throw new Error("WAV file missing data chunk");
      }

      offset += 8 + chunkSize;
    }

    throw new Error("WAV file missing fmt chunk");
  }

  /**
   * Check if two WAV formats are compatible for concatenation
   */
  private isFormatCompatible(header1: WAVHeader, header2: WAVHeader): boolean {
    return (
      header1.sampleRate === header2.sampleRate &&
      header1.channels === header2.channels &&
      header1.bitsPerSample === header2.bitsPerSample
    );
  }

  /**
   * Concatenate multiple WAV files into a single WAV file
   */
  private concatenateWAVFiles(buffers: ArrayBuffer[]): ArrayBuffer {
    if (buffers.length === 0) return new ArrayBuffer(0);
    if (buffers.length === 1) return buffers[0];

    console.log(`[WAV_MANAGER] Concatenating ${buffers.length} WAV files`);

    // Extract audio data from each WAV file
    const audioDataChunks: Uint8Array[] = [];
    let totalAudioSize = 0;
    let format: WAVHeader | null = null;

    for (let i = 0; i < buffers.length; i++) {
      try {
        const header = this.parseWAVHeader(buffers[i]);

        if (format === null) {
          format = header;
        } else if (!this.isFormatCompatible(header, format)) {
          console.warn(
            `[WAV_MANAGER] Format mismatch in chunk ${i}, attempting to continue`
          );
        }

        // Extract audio data (skip WAV header)
        const audioData = new Uint8Array(
          buffers[i],
          header.audioDataOffset,
          header.audioDataSize
        );

        audioDataChunks.push(audioData);
        totalAudioSize += audioData.length;

        console.log(
          `[WAV_MANAGER] Extracted ${audioData.length} bytes from chunk ${i}`
        );
      } catch (error) {
        console.error(`[WAV_MANAGER] Failed to process chunk ${i}:`, error);
        // Skip invalid chunks but continue processing
        continue;
      }
    }

    if (!format || audioDataChunks.length === 0) {
      throw new Error("No valid audio data found in chunks");
    }

    // Create new WAV file with combined audio data
    const combinedBuffer = this.createWAVFile(
      audioDataChunks,
      totalAudioSize,
      format.sampleRate,
      format.channels,
      format.bitsPerSample
    );

    console.log(
      `[WAV_MANAGER] Created combined WAV file: ${combinedBuffer.byteLength} bytes`
    );
    return combinedBuffer;
  }

  /**
   * Create a new WAV file with the provided audio data and format
   */
  private createWAVFile(
    audioChunks: Uint8Array[],
    totalAudioSize: number,
    sampleRate: number,
    channels: number,
    bitsPerSample: number
  ): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + totalAudioSize);
    const view = new DataView(buffer);

    // WAV header
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + totalAudioSize, true); // File size - 8
    this.writeString(view, 8, "WAVE");

    // Format chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Format chunk size
    view.setUint16(20, 1, true); // Audio format (PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, (sampleRate * channels * bitsPerSample) / 8, true); // Byte rate
    view.setUint16(32, (channels * bitsPerSample) / 8, true); // Block align
    view.setUint16(34, bitsPerSample, true);

    // Data chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, totalAudioSize, true);

    // Copy audio data
    const audioView = new Uint8Array(buffer, 44);
    let offset = 0;
    for (const chunk of audioChunks) {
      audioView.set(chunk, offset);
      offset += chunk.length;
    }

    return buffer;
  }

  /**
   * Read a string from DataView at specified offset
   */
  private readString(view: DataView, offset: number, length: number): string {
    let result = "";
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(view.getUint8(offset + i));
    }
    return result;
  }

  /**
   * Write a string to DataView at specified offset
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

/**
 * Factory function to create a new WAV audio chunk manager
 */
export function createWAVAudioChunkManager(): WAVAudioChunkManager {
  return new WAVAudioChunkManager();
}
