/**
 * Lazy Loading Utilities for Images
 * 
 * Provides utilities for implementing lazy loading with:
 * - Intersection Observer based loading
 * - Progressive image loading
 * - Blur-up effect support
 * 
 * Requirements: 6.2, 11.3
 */

/**
 * Options for lazy loading behavior
 */
export interface LazyLoadOptions {
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number | number[];
  /** Whether to use native lazy loading */
  useNative?: boolean;
  /** Callback when image starts loading */
  onLoadStart?: () => void;
  /** Callback when image finishes loading */
  onLoadComplete?: () => void;
  /** Callback on load error */
  onError?: (error: Error) => void;
}

/**
 * Default lazy load options
 */
export const DEFAULT_LAZY_LOAD_OPTIONS: LazyLoadOptions = {
  rootMargin: '200px 0px',
  threshold: 0.1,
  useNative: true,
};

/**
 * Check if native lazy loading is supported
 */
export function supportsNativeLazyLoading(): boolean {
  if (typeof window === 'undefined') return false;
  return 'loading' in HTMLImageElement.prototype;
}

/**
 * Check if Intersection Observer is supported
 */
export function supportsIntersectionObserver(): boolean {
  if (typeof window === 'undefined') return false;
  return 'IntersectionObserver' in window;
}

/**
 * Create an intersection observer for lazy loading
 */
export function createLazyLoadObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: LazyLoadOptions = {}
): IntersectionObserver | null {
  if (!supportsIntersectionObserver()) {
    return null;
  }

  const mergedOptions = { ...DEFAULT_LAZY_LOAD_OPTIONS, ...options };

  return new IntersectionObserver(callback, {
    rootMargin: mergedOptions.rootMargin,
    threshold: mergedOptions.threshold,
  });
}

/**
 * Progressive image loader
 * Loads a low-quality placeholder first, then the full image
 */
export class ProgressiveImageLoader {
  private placeholderSrc: string;
  private fullSrc: string;
  private options: LazyLoadOptions;

  constructor(
    placeholderSrc: string,
    fullSrc: string,
    options: LazyLoadOptions = {}
  ) {
    this.placeholderSrc = placeholderSrc;
    this.fullSrc = fullSrc;
    this.options = { ...DEFAULT_LAZY_LOAD_OPTIONS, ...options };
  }

  /**
   * Load the full image
   */
  async load(): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.options.onLoadComplete?.();
        resolve(img);
      };

      img.onerror = () => {
        const error = new Error(`Failed to load image: ${this.fullSrc}`);
        this.options.onError?.(error);
        reject(error);
      };

      this.options.onLoadStart?.();
      img.src = this.fullSrc;
    });
  }

  /**
   * Get the placeholder source
   */
  getPlaceholder(): string {
    return this.placeholderSrc;
  }

  /**
   * Get the full source
   */
  getFullSrc(): string {
    return this.fullSrc;
  }
}

/**
 * Preload an image
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload: ${src}`));
    img.src = src;
  });
}

/**
 * Preload multiple images
 */
export async function preloadImages(
  srcs: string[],
  options: { parallel?: boolean; onProgress?: (loaded: number, total: number) => void } = {}
): Promise<void> {
  const { parallel = true, onProgress } = options;
  let loaded = 0;

  const loadWithProgress = async (src: string) => {
    await preloadImage(src);
    loaded++;
    onProgress?.(loaded, srcs.length);
  };

  if (parallel) {
    await Promise.all(srcs.map(loadWithProgress));
  } else {
    for (const src of srcs) {
      await loadWithProgress(src);
    }
  }
}

/**
 * Get loading attribute value based on priority
 */
export function getLoadingAttribute(
  priority: 'high' | 'low' | 'auto' = 'auto'
): 'eager' | 'lazy' {
  if (priority === 'high') return 'eager';
  if (priority === 'low') return 'lazy';
  return 'lazy';
}

/**
 * Get fetchpriority attribute value
 */
export function getFetchPriority(
  priority: 'high' | 'low' | 'auto' = 'auto'
): 'high' | 'low' | 'auto' {
  return priority;
}

/**
 * Generate blur data URL from dimensions
 */
export function generateBlurDataUrl(
  width: number = 10,
  height: number = 10,
  color: string = '#e2e8f0'
): string {
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Calculate aspect ratio from dimensions
 */
export function calculateAspectRatio(width: number, height: number): number {
  return width / height;
}

/**
 * Get dimensions maintaining aspect ratio
 */
export function getDimensionsForAspectRatio(
  targetWidth: number,
  aspectRatio: number
): { width: number; height: number } {
  return {
    width: targetWidth,
    height: Math.round(targetWidth / aspectRatio),
  };
}

/**
 * Image loading state
 */
export type ImageLoadingState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Track image loading state
 */
export function createImageLoadingTracker() {
  const states = new Map<string, ImageLoadingState>();

  return {
    getState(src: string): ImageLoadingState {
      return states.get(src) || 'idle';
    },

    setState(src: string, state: ImageLoadingState): void {
      states.set(src, state);
    },

    isLoaded(src: string): boolean {
      return states.get(src) === 'loaded';
    },

    isLoading(src: string): boolean {
      return states.get(src) === 'loading';
    },

    clear(): void {
      states.clear();
    },
  };
}
