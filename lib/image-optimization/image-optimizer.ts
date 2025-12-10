/**
 * Image Optimization Service
 * 
 * Provides comprehensive image optimization including:
 * - Image compression
 * - Multiple size generation
 * - WebP format conversion
 * - Blur placeholder generation
 * - Lazy loading utilities
 * 
 * Requirements: 6.2, 11.3
 */

import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Image size presets for different use cases
 */
export const IMAGE_SIZE_PRESETS = {
  thumbnail: { width: 150, height: 150, quality: 70 },
  small: { width: 400, height: 300, quality: 75 },
  medium: { width: 800, height: 600, quality: 80 },
  large: { width: 1200, height: 900, quality: 85 },
  banner: { width: 1920, height: 1080, quality: 85 },
  print: { width: 3000, height: 2000, quality: 100 },
} as const;

export type ImageSizePreset = keyof typeof IMAGE_SIZE_PRESETS;

/**
 * Supported output formats
 */
export type ImageFormat = 'webp' | 'avif' | 'png' | 'jpg' | 'auto';

/**
 * Image optimization options
 */
export interface ImageOptimizationOptions {
  /** Target width in pixels */
  width?: number;
  /** Target height in pixels */
  height?: number;
  /** Quality level (1-100) */
  quality?: number;
  /** Output format */
  format?: ImageFormat;
  /** Crop mode */
  crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'thumb';
  /** Generate blur placeholder */
  generateBlurPlaceholder?: boolean;
  /** Gravity for cropping */
  gravity?: 'auto' | 'center' | 'face' | 'faces';
}

/**
 * Result of image optimization with multiple versions
 */
export interface OptimizedImageResult {
  /** Original image URL */
  originalUrl: string;
  /** Optimized image URL (WebP format) */
  optimizedUrl: string;
  /** Thumbnail URL */
  thumbnailUrl: string;
  /** Small size URL */
  smallUrl: string;
  /** Medium size URL */
  mediumUrl: string;
  /** Large size URL */
  largeUrl: string;
  /** Banner size URL */
  bannerUrl?: string;
  /** Print-ready URL (high quality) */
  printUrl?: string;
  /** Base64 blur placeholder for lazy loading */
  blurPlaceholder?: string;
  /** Public ID for the image */
  publicId: string;
  /** Original dimensions */
  dimensions: { width: number; height: number };
  /** File size in bytes */
  bytes: number;
  /** Original format */
  format: string;
}

/**
 * Responsive image srcset entry
 */
export interface SrcSetEntry {
  url: string;
  width: number;
  descriptor: string;
}

/**
 * Image Optimizer Service
 * Handles all image optimization operations
 */
export class ImageOptimizer {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    if (!this.isConfigured) {
      console.warn("[IMAGE_OPTIMIZER] Cloudinary not configured. Using fallback URLs.");
    }
  }

  /**
   * Check if the service is properly configured
   */
  checkConfiguration(): boolean {
    return this.isConfigured;
  }

  /**
   * Upload and optimize an image with multiple size variants
   */
  async uploadAndOptimize(
    imageData: string | Buffer,
    storyId: string,
    imageIndex: number,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageResult> {
    if (!this.isConfigured) {
      return this.getFallbackResult(storyId, imageIndex);
    }

    try {
      // Prepare image data for upload
      const uploadData = this.prepareImageData(imageData);

      // Upload with automatic format optimization
      const uploadResult = await cloudinary.uploader.upload(uploadData, {
        folder: `stories/${storyId}/images`,
        public_id: `image-${imageIndex}`,
        resource_type: "image",
        overwrite: true,
        // Apply initial transformations
        transformation: [
          {
            quality: "auto:best",
            fetch_format: "auto",
          },
        ],
      });

      // Generate all size variants
      const result = await this.generateAllSizes(uploadResult, options);

      return result;
    } catch (error) {
      console.error("[IMAGE_OPTIMIZER] Upload failed:", error);
      return this.getFallbackResult(storyId, imageIndex);
    }
  }

  /**
   * Generate all size variants for an uploaded image
   */
  private async generateAllSizes(
    uploadResult: UploadApiResponse,
    options: ImageOptimizationOptions
  ): Promise<OptimizedImageResult> {
    const publicId = uploadResult.public_id;
    const format = options.format || 'webp';

    // Generate URLs for each size preset
    const thumbnailUrl = this.getOptimizedUrl(publicId, {
      ...IMAGE_SIZE_PRESETS.thumbnail,
      format,
      crop: 'thumb',
      gravity: 'auto',
    });

    const smallUrl = this.getOptimizedUrl(publicId, {
      ...IMAGE_SIZE_PRESETS.small,
      format,
      crop: 'limit',
    });

    const mediumUrl = this.getOptimizedUrl(publicId, {
      ...IMAGE_SIZE_PRESETS.medium,
      format,
      crop: 'limit',
    });

    const largeUrl = this.getOptimizedUrl(publicId, {
      ...IMAGE_SIZE_PRESETS.large,
      format,
      crop: 'limit',
    });

    const bannerUrl = this.getOptimizedUrl(publicId, {
      ...IMAGE_SIZE_PRESETS.banner,
      format,
      crop: 'limit',
    });

    const printUrl = this.getOptimizedUrl(publicId, {
      ...IMAGE_SIZE_PRESETS.print,
      format: 'png', // PNG for print quality
      crop: 'limit',
    });

    // Generate blur placeholder
    let blurPlaceholder: string | undefined;
    if (options.generateBlurPlaceholder !== false) {
      blurPlaceholder = await this.generateBlurPlaceholder(publicId);
    }

    return {
      originalUrl: uploadResult.secure_url,
      optimizedUrl: largeUrl,
      thumbnailUrl,
      smallUrl,
      mediumUrl,
      largeUrl,
      bannerUrl,
      printUrl,
      blurPlaceholder,
      publicId,
      dimensions: {
        width: uploadResult.width,
        height: uploadResult.height,
      },
      bytes: uploadResult.bytes,
      format: uploadResult.format,
    };
  }

  /**
   * Get optimized URL for a specific size and format
   */
  getOptimizedUrl(
    publicId: string,
    options: ImageOptimizationOptions
  ): string {
    const transformations: Record<string, unknown>[] = [];

    // Add resize transformation
    if (options.width || options.height) {
      transformations.push({
        width: options.width,
        height: options.height,
        crop: options.crop || 'limit',
        gravity: options.gravity,
      });
    }

    // Add quality and format transformation
    transformations.push({
      quality: options.quality || 'auto',
      fetch_format: options.format === 'auto' ? 'auto' : options.format || 'webp',
    });

    return cloudinary.url(publicId, {
      transformation: transformations,
      secure: true,
    });
  }

  /**
   * Generate a blur placeholder for lazy loading
   */
  async generateBlurPlaceholder(publicId: string): Promise<string> {
    try {
      // Generate a tiny, blurred version of the image
      const blurUrl = cloudinary.url(publicId, {
        transformation: [
          {
            width: 20,
            height: 20,
            crop: 'fill',
            quality: 30,
            effect: 'blur:1000',
            fetch_format: 'webp',
          },
        ],
        secure: true,
      });

      // Fetch the blurred image and convert to base64
      const response = await fetch(blurUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch blur placeholder');
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/webp';

      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error("[IMAGE_OPTIMIZER] Blur placeholder generation failed:", error);
      // Return a simple gray placeholder
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';
    }
  }

  /**
   * Generate responsive srcset for an image
   */
  generateSrcSet(
    publicId: string,
    widths: number[] = [400, 800, 1200, 1600, 2000],
    format: ImageFormat = 'webp'
  ): SrcSetEntry[] {
    return widths.map(width => ({
      url: this.getOptimizedUrl(publicId, {
        width,
        format,
        quality: this.getQualityForWidth(width),
      }),
      width,
      descriptor: `${width}w`,
    }));
  }

  /**
   * Get quality setting based on image width
   */
  private getQualityForWidth(width: number): number {
    if (width <= 400) return 70;
    if (width <= 800) return 75;
    if (width <= 1200) return 80;
    if (width <= 1600) return 85;
    return 90;
  }

  /**
   * Generate sizes attribute for responsive images
   */
  generateSizesAttribute(breakpoints: { maxWidth: number; size: string }[]): string {
    return breakpoints
      .map(bp => `(max-width: ${bp.maxWidth}px) ${bp.size}`)
      .concat(['100vw'])
      .join(', ');
  }

  /**
   * Compress an existing image URL
   */
  async compressImage(
    imageUrl: string,
    options: ImageOptimizationOptions = {}
  ): Promise<string> {
    if (!this.isConfigured) {
      return imageUrl;
    }

    try {
      // Upload from URL with compression
      const result = await cloudinary.uploader.upload(imageUrl, {
        resource_type: "image",
        transformation: [
          {
            width: options.width || 1200,
            height: options.height,
            crop: options.crop || 'limit',
            quality: options.quality || 'auto:good',
            fetch_format: options.format || 'webp',
          },
        ],
      });

      return result.secure_url;
    } catch (error) {
      console.error("[IMAGE_OPTIMIZER] Compression failed:", error);
      return imageUrl;
    }
  }

  /**
   * Convert image to WebP format
   */
  async convertToWebP(
    imageUrl: string,
    quality: number = 85
  ): Promise<string> {
    return this.compressImage(imageUrl, {
      format: 'webp',
      quality,
    });
  }

  /**
   * Prepare image data for upload
   */
  private prepareImageData(imageData: string | Buffer): string {
    if (Buffer.isBuffer(imageData)) {
      return `data:image/png;base64,${imageData.toString('base64')}`;
    }

    if (imageData.startsWith('data:')) {
      return imageData;
    }

    if (imageData.startsWith('http')) {
      return imageData;
    }

    // Assume base64 string
    return `data:image/png;base64,${imageData}`;
  }

  /**
   * Get fallback result when Cloudinary is not configured
   */
  private getFallbackResult(storyId: string, imageIndex: number): OptimizedImageResult {
    const placeholderUrl = `https://placehold.co/1200x800/e2e8f0/64748b?text=Story+Image+${imageIndex + 1}`;
    const thumbnailUrl = `https://placehold.co/150x150/e2e8f0/64748b?text=${imageIndex + 1}`;
    const smallUrl = `https://placehold.co/400x300/e2e8f0/64748b?text=Image+${imageIndex + 1}`;
    const mediumUrl = `https://placehold.co/800x600/e2e8f0/64748b?text=Image+${imageIndex + 1}`;

    return {
      originalUrl: placeholderUrl,
      optimizedUrl: placeholderUrl,
      thumbnailUrl,
      smallUrl,
      mediumUrl,
      largeUrl: placeholderUrl,
      bannerUrl: `https://placehold.co/1920x1080/e2e8f0/64748b?text=Banner+${imageIndex + 1}`,
      printUrl: placeholderUrl,
      blurPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==',
      publicId: `placeholder-${storyId}-${imageIndex}`,
      dimensions: { width: 1200, height: 800 },
      bytes: 0,
      format: 'png',
    };
  }

  /**
   * Delete optimized images for a story
   */
  async deleteStoryImages(storyId: string): Promise<void> {
    if (!this.isConfigured) return;

    try {
      await cloudinary.api.delete_resources_by_prefix(`stories/${storyId}/images/`);
    } catch (error) {
      console.error("[IMAGE_OPTIMIZER] Delete failed:", error);
    }
  }
}

// Export singleton instance
export const imageOptimizer = new ImageOptimizer();
