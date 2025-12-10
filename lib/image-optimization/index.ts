/**
 * Image Optimization Module
 * 
 * Comprehensive image optimization including:
 * - Image compression
 * - Multiple size generation
 * - WebP format conversion
 * - Blur placeholder generation
 * - Lazy loading utilities
 * 
 * Requirements: 6.2, 11.3
 */

// Image Optimizer
export {
  ImageOptimizer,
  imageOptimizer,
  IMAGE_SIZE_PRESETS,
} from './image-optimizer';

export type {
  ImageSizePreset,
  ImageFormat,
  ImageOptimizationOptions,
  OptimizedImageResult,
  SrcSetEntry,
} from './image-optimizer';

// Lazy Loading Utilities
export {
  DEFAULT_LAZY_LOAD_OPTIONS,
  supportsNativeLazyLoading,
  supportsIntersectionObserver,
  createLazyLoadObserver,
  ProgressiveImageLoader,
  preloadImage,
  preloadImages,
  getLoadingAttribute,
  getFetchPriority,
  generateBlurDataUrl,
  calculateAspectRatio,
  getDimensionsForAspectRatio,
  createImageLoadingTracker,
} from './lazy-loading';

export type {
  LazyLoadOptions,
  ImageLoadingState,
} from './lazy-loading';
