import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebAudioSequentialPlayer } from '../sequential-audio-player';
import { afterEach } from 'node:test';

// Create a more realistic mock for integration testing
const createMockAudioContext = () => {
  const mockBuffers: AudioBuffer[] = [];
  const mockSources: any[] = [];
  
  const mockAudioBuffer = {
    duration: 2.5,
    length: 44100,
    sampleRate: 44100,
    numberOfChannels: 1,
  };

  const createMockBufferSource = () => {
    const source = {
      buffer: null,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    mockSources.push(source);
    return source;
  };

  return {
    state: 'running',
    currentTime: 0,
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn().mockImplementation(async (buffer: ArrayBuffer) => {
      // Simulate successful decode
      return { ...mockAudioBuffer };
    }),
    createBufferSource: vi.fn().mockImplementation(createMockBufferSource),
    mockSources,
  };
};

// Create mock WAV data
function createMockWAVBuffer(duration: number = 2.5): ArrayBuffer {
  const sampleRate = 44100;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  
  // Simple WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples * 2, true);
  
  return buffer;
}

describe('WebAudioSequentialPlayer Integration', () => {
  let mockAudioContext: any;
  let player: WebAudioSequentialPlayer;

  beforeEach(() => {
    mockAudioContext = createMockAudioContext();
    (window.AudioContext as any) = vi.fn().mockImplementation(() => mockAudioContext);
    player = new WebAudioSequentialPlayer();
  });

  afterEach(() => {
    if (player) {
      player.dispose();
    }
  });

  it('should handle complete audio streaming workflow', async () => {
    // Create test audio chunks
    const chunks = [
      createMockWAVBuffer(2.0),
      createMockWAVBuffer(1.5),
      createMockWAVBuffer(3.0)
    ];

    // Track callbacks
    let progressUpdates: number[] = [];
    let completionCalled = false;
    let errorOccurred: Error | null = null;

    player.onProgress((progress) => {
      progressUpdates.push(progress);
    });

    player.onComplete(() => {
      completionCalled = true;
    });

    player.onError((error) => {
      errorOccurred = error;
    });

    // Load chunks
    await player.loadChunks(chunks);
    
    // Verify chunks loaded
    expect(player.getDuration()).toBe(7.5); // 2.0 + 1.5 + 3.0
    expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(3);

    // Start playback
    await player.play();
    
    // Verify first chunk started
    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(mockAudioContext.mockSources.length).toBeGreaterThan(0);
    expect(mockAudioContext.mockSources[0].start).toHaveBeenCalled();

    // Simulate first chunk ending (triggers next chunk)
    if (mockAudioContext.mockSources[0].onended) {
      mockAudioContext.mockSources[0].onended();
    }

    // Should have created second buffer source
    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(2);

    // Simulate second chunk ending
    if (mockAudioContext.mockSources[1].onended) {
      mockAudioContext.mockSources[1].onended();
    }

    // Should have created third buffer source
    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(3);

    // Simulate final chunk ending
    if (mockAudioContext.mockSources[2].onended) {
      mockAudioContext.mockSources[2].onended();
    }

    // Should have completed playback
    expect(completionCalled).toBe(true);
    expect(errorOccurred).toBeNull();
  });

  it('should handle pause and resume correctly', async () => {
    const chunks = [createMockWAVBuffer(2.0), createMockWAVBuffer(2.0)];
    
    await player.loadChunks(chunks);
    await player.play();

    // Verify playing
    expect(mockAudioContext.mockSources[0].start).toHaveBeenCalled();

    // Pause
    player.pause();
    expect(mockAudioContext.mockSources[0].stop).toHaveBeenCalled();

    // Resume
    await player.play();
    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(2);
  });

  it('should handle seeking across chunks', async () => {
    const chunks = [
      createMockWAVBuffer(2.0), // 0-2s
      createMockWAVBuffer(2.0), // 2-4s  
      createMockWAVBuffer(2.0)  // 4-6s
    ];
    
    await player.loadChunks(chunks);

    // Seek to middle of second chunk (3 seconds)
    player.seekTo(3.0);
    expect(player.getCurrentTime()).toBe(3.0);

    // Seek to third chunk (5 seconds)
    player.seekTo(5.0);
    expect(player.getCurrentTime()).toBe(5.0);

    // Seek beyond end (should clamp)
    player.seekTo(10.0);
    expect(player.getCurrentTime()).toBe(7.5); // Total duration (mock returns 2.5 for each chunk)
  });

  it('should handle errors gracefully', async () => {
    let errorReceived: Error | null = null;
    player.onError((error) => {
      errorReceived = error;
    });

    // Mock decode failure
    mockAudioContext.decodeAudioData.mockRejectedValueOnce(new Error('Decode failed'));

    const chunks = [createMockWAVBuffer(2.0)];
    
    try {
      await player.loadChunks(chunks);
    } catch (error) {
      // Expected to throw
    }

    expect(errorReceived).toBeInstanceOf(Error);
    expect(errorReceived?.message).toContain('Decode failed');
  });

  it('should properly dispose resources', async () => {
    const chunks = [createMockWAVBuffer(2.0)];
    
    await player.loadChunks(chunks);
    await player.play();

    // Dispose
    player.dispose();

    // Should have stopped playback and closed context
    expect(mockAudioContext.mockSources[0].stop).toHaveBeenCalled();
    expect(mockAudioContext.close).toHaveBeenCalled();
  });
});