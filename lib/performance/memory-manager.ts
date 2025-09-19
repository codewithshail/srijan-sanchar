/**
 * Memory Manager for Audio Buffer Optimization
 * 
 * Optimizes memory usage by properly disposing of audio buffers after playback
 * and implementing smart memory management strategies.
 */

export interface AudioBufferInfo {
  id: string;
  buffer: ArrayBuffer;
  size: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  isActive: boolean;
  metadata?: {
    chunkIndex?: number;
    duration?: number;
    sampleRate?: number;
  };
}

export interface MemoryStats {
  totalBuffers: number;
  totalSize: number;
  activeBuffers: number;
  activeSize: number;
  memoryUsageMB: number;
  oldestBufferAge: number;
  averageBufferSize: number;
}

export interface MemoryManagerOptions {
  maxBuffers?: number;
  maxMemoryMB?: number;
  bufferTtlMs?: number;
  cleanupIntervalMs?: number;
  autoCleanup?: boolean;
}

export class AudioMemoryManager {
  private buffers = new Map<string, AudioBufferInfo>();
  private readonly maxBuffers: number;
  private readonly maxMemoryBytes: number;
  private readonly bufferTtlMs: number;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly autoCleanup: boolean;
  
  private stats = {
    buffersCreated: 0,
    buffersDisposed: 0,
    memoryPeakBytes: 0,
    cleanupRuns: 0
  };

  constructor(options: MemoryManagerOptions = {}) {
    this.maxBuffers = options.maxBuffers || 50;
    this.maxMemoryBytes = (options.maxMemoryMB || 100) * 1024 * 1024; // 100MB default
    this.bufferTtlMs = options.bufferTtlMs || 10 * 60 * 1000; // 10 minutes default
    this.autoCleanup = options.autoCleanup !== false;
    
    if (this.autoCleanup) {
      const cleanupInterval = options.cleanupIntervalMs || 2 * 60 * 1000; // 2 minutes
      this.startCleanupInterval(cleanupInterval);
    }
    
    console.log('[MEMORY_MANAGER] Initialized with options:', {
      maxBuffers: this.maxBuffers,
      maxMemoryMB: options.maxMemoryMB || 100,
      bufferTtlMs: this.bufferTtlMs,
      autoCleanup: this.autoCleanup
    });
  }

  /**
   * Register a new audio buffer for memory management
   */
  registerBuffer(
    id: string,
    buffer: ArrayBuffer,
    metadata?: AudioBufferInfo['metadata']
  ): void {
    const now = Date.now();
    
    // Ensure we have capacity
    this.ensureCapacity(buffer.byteLength);
    
    const bufferInfo: AudioBufferInfo = {
      id,
      buffer,
      size: buffer.byteLength,
      createdAt: now,
      lastAccessed: now,
      accessCount: 1,
      isActive: true,
      metadata
    };
    
    this.buffers.set(id, bufferInfo);
    this.stats.buffersCreated++;
    
    const currentMemory = this.getTotalMemoryUsage();
    if (currentMemory > this.stats.memoryPeakBytes) {
      this.stats.memoryPeakBytes = currentMemory;
    }
    
    console.log('[MEMORY_MANAGER] Registered buffer:', {
      id: id.substring(0, 20) + '...',
      size: buffer.byteLength,
      totalBuffers: this.buffers.size,
      totalMemoryMB: (currentMemory / (1024 * 1024)).toFixed(2)
    });
  }

  /**
   * Access a buffer (updates access statistics)
   */
  accessBuffer(id: string): ArrayBuffer | null {
    const bufferInfo = this.buffers.get(id);
    if (!bufferInfo) {
      return null;
    }
    
    const now = Date.now();
    bufferInfo.lastAccessed = now;
    bufferInfo.accessCount++;
    
    // Check if buffer has expired
    if (now - bufferInfo.createdAt > this.bufferTtlMs) {
      console.log('[MEMORY_MANAGER] Buffer expired, disposing:', id.substring(0, 20) + '...');
      this.disposeBuffer(id);
      return null;
    }
    
    return bufferInfo.buffer;
  }

  /**
   * Mark buffer as inactive (no longer needed for playback)
   */
  markBufferInactive(id: string): void {
    const bufferInfo = this.buffers.get(id);
    if (bufferInfo) {
      bufferInfo.isActive = false;
      console.log('[MEMORY_MANAGER] Marked buffer as inactive:', id.substring(0, 20) + '...');
    }
  }

  /**
   * Mark buffer as active (needed for playback)
   */
  markBufferActive(id: string): void {
    const bufferInfo = this.buffers.get(id);
    if (bufferInfo) {
      bufferInfo.isActive = true;
      bufferInfo.lastAccessed = Date.now();
      console.log('[MEMORY_MANAGER] Marked buffer as active:', id.substring(0, 20) + '...');
    }
  }

  /**
   * Dispose of a specific buffer
   */
  disposeBuffer(id: string): boolean {
    const bufferInfo = this.buffers.get(id);
    if (!bufferInfo) {
      return false;
    }
    
    this.buffers.delete(id);
    this.stats.buffersDisposed++;
    
    console.log('[MEMORY_MANAGER] Disposed buffer:', {
      id: id.substring(0, 20) + '...',
      size: bufferInfo.size,
      age: Date.now() - bufferInfo.createdAt,
      accessCount: bufferInfo.accessCount,
      remainingBuffers: this.buffers.size
    });
    
    return true;
  }

  /**
   * Dispose of multiple buffers by IDs
   */
  disposeBuffers(ids: string[]): number {
    let disposedCount = 0;
    for (const id of ids) {
      if (this.disposeBuffer(id)) {
        disposedCount++;
      }
    }
    return disposedCount;
  }

  /**
   * Dispose of all inactive buffers
   */
  disposeInactiveBuffers(): number {
    const inactiveIds = Array.from(this.buffers.entries())
      .filter(([_, info]) => !info.isActive)
      .map(([id, _]) => id);
    
    const disposedCount = this.disposeBuffers(inactiveIds);
    
    if (disposedCount > 0) {
      console.log('[MEMORY_MANAGER] Disposed inactive buffers:', {
        disposedCount,
        remainingBuffers: this.buffers.size
      });
    }
    
    return disposedCount;
  }

  /**
   * Ensure memory capacity for new buffer
   */
  private ensureCapacity(newBufferSize: number): void {
    const currentMemory = this.getTotalMemoryUsage();
    
    // Check if we need to free up space
    while (
      (this.buffers.size >= this.maxBuffers) ||
      (currentMemory + newBufferSize > this.maxMemoryBytes)
    ) {
      // First try to dispose inactive buffers
      const inactiveDisposed = this.disposeInactiveBuffers();
      
      if (inactiveDisposed === 0) {
        // No inactive buffers, dispose least recently used
        this.disposeLeastRecentlyUsed();
      }
      
      // Recalculate current memory
      const newCurrentMemory = this.getTotalMemoryUsage();
      if (newCurrentMemory === currentMemory) {
        // No progress made, break to avoid infinite loop
        console.warn('[MEMORY_MANAGER] Unable to free sufficient memory');
        break;
      }
    }
  }

  /**
   * Dispose least recently used buffer
   */
  private disposeLeastRecentlyUsed(): void {
    if (this.buffers.size === 0) return;
    
    let oldestId: string | null = null;
    let oldestTime = Date.now();
    
    for (const [id, info] of this.buffers.entries()) {
      if (info.lastAccessed < oldestTime) {
        oldestTime = info.lastAccessed;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      console.log('[MEMORY_MANAGER] Disposing LRU buffer due to capacity constraints');
      this.disposeBuffer(oldestId);
    }
  }

  /**
   * Get total memory usage in bytes
   */
  private getTotalMemoryUsage(): number {
    let totalSize = 0;
    for (const info of this.buffers.values()) {
      totalSize += info.size;
    }
    return totalSize;
  }

  /**
   * Start periodic cleanup of expired buffers
   */
  private startCleanupInterval(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, intervalMs);
  }

  /**
   * Perform cleanup of expired and inactive buffers
   */
  performCleanup(): void {
    const startTime = Date.now();
    const initialBufferCount = this.buffers.size;
    const initialMemory = this.getTotalMemoryUsage();
    
    // Clean up expired buffers
    const expiredIds: string[] = [];
    const now = Date.now();
    
    for (const [id, info] of this.buffers.entries()) {
      if (now - info.createdAt > this.bufferTtlMs) {
        expiredIds.push(id);
      }
    }
    
    const expiredDisposed = this.disposeBuffers(expiredIds);
    
    // Clean up inactive buffers if memory usage is high
    const currentMemory = this.getTotalMemoryUsage();
    const memoryUsagePercent = (currentMemory / this.maxMemoryBytes) * 100;
    
    let inactiveDisposed = 0;
    if (memoryUsagePercent > 70) { // Clean up inactive buffers if using >70% of max memory
      inactiveDisposed = this.disposeInactiveBuffers();
    }
    
    const finalMemory = this.getTotalMemoryUsage();
    const cleanupTime = Date.now() - startTime;
    
    this.stats.cleanupRuns++;
    
    if (expiredDisposed > 0 || inactiveDisposed > 0) {
      console.log('[MEMORY_MANAGER] Cleanup completed:', {
        expiredDisposed,
        inactiveDisposed,
        totalDisposed: expiredDisposed + inactiveDisposed,
        remainingBuffers: this.buffers.size,
        memoryFreedMB: ((initialMemory - finalMemory) / (1024 * 1024)).toFixed(2),
        cleanupTimeMs: cleanupTime
      });
    }
  }

  /**
   * Get memory statistics
   */
  getStats(): MemoryStats {
    const totalSize = this.getTotalMemoryUsage();
    const activeBuffers = Array.from(this.buffers.values()).filter(info => info.isActive);
    const activeSize = activeBuffers.reduce((sum, info) => sum + info.size, 0);
    
    const now = Date.now();
    const oldestBuffer = Array.from(this.buffers.values())
      .reduce((oldest, current) => 
        current.createdAt < oldest.createdAt ? current : oldest, 
        { createdAt: now } as AudioBufferInfo
      );
    
    const oldestBufferAge = this.buffers.size > 0 ? now - oldestBuffer.createdAt : 0;
    const averageBufferSize = this.buffers.size > 0 ? totalSize / this.buffers.size : 0;
    
    return {
      totalBuffers: this.buffers.size,
      totalSize,
      activeBuffers: activeBuffers.length,
      activeSize,
      memoryUsageMB: totalSize / (1024 * 1024),
      oldestBufferAge,
      averageBufferSize
    };
  }

  /**
   * Get detailed buffer information
   */
  getBufferInfo(): AudioBufferInfo[] {
    return Array.from(this.buffers.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    const bufferCount = this.buffers.size;
    const memoryFreed = this.getTotalMemoryUsage();
    
    this.buffers.clear();
    
    console.log('[MEMORY_MANAGER] Cleared all buffers:', {
      buffersCleared: bufferCount,
      memoryFreedMB: (memoryFreed / (1024 * 1024)).toFixed(2)
    });
  }

  /**
   * Dispose of memory manager and cleanup resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    this.clear();
    
    console.log('[MEMORY_MANAGER] Memory manager disposed:', {
      totalBuffersCreated: this.stats.buffersCreated,
      totalBuffersDisposed: this.stats.buffersDisposed,
      peakMemoryMB: (this.stats.memoryPeakBytes / (1024 * 1024)).toFixed(2),
      cleanupRuns: this.stats.cleanupRuns
    });
  }
}

// Global memory manager instance
let globalMemoryManager: AudioMemoryManager | null = null;

/**
 * Get or create global memory manager instance
 */
export function getMemoryManager(options?: MemoryManagerOptions): AudioMemoryManager {
  if (!globalMemoryManager) {
    globalMemoryManager = new AudioMemoryManager(options);
  }
  return globalMemoryManager;
}

/**
 * Dispose global memory manager instance
 */
export function disposeMemoryManager(): void {
  if (globalMemoryManager) {
    globalMemoryManager.dispose();
    globalMemoryManager = null;
  }
}