import { v2 as cloudinary } from "cloudinary";
import { imageOptimizer, type OptimizedImageResult } from "@/lib/image-optimization";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Image upload options for different use cases
 */
export interface ImageUploadOptions {
  /** Target optimization: 'web' for online viewing, 'print' for physical printing */
  target?: 'web' | 'print';
  /** Generate thumbnail alongside main image */
  generateThumbnail?: boolean;
  /** Generate blur placeholder for lazy loading */
  generateBlurPlaceholder?: boolean;
  /** Custom transformations to apply */
  transformations?: {
    width?: number;
    height?: number;
    quality?: number | 'auto';
    format?: 'auto' | 'webp' | 'png' | 'jpg';
  };
}

/**
 * Result of image upload with multiple versions
 */
export interface ImageUploadResult {
  /** Main image URL */
  url: string;
  /** Thumbnail URL (if generated) */
  thumbnailUrl?: string;
  /** Small size URL */
  smallUrl?: string;
  /** Medium size URL */
  mediumUrl?: string;
  /** Large size URL */
  largeUrl?: string;
  /** Banner size URL */
  bannerUrl?: string;
  /** Print-optimized URL (if target is print) */
  printUrl?: string;
  /** Blur placeholder for lazy loading */
  blurPlaceholder?: string;
  /** Public ID for the image */
  publicId: string;
  /** Image dimensions */
  width: number;
  height: number;
  /** File size in bytes */
  bytes: number;
  /** Format of the uploaded image */
  format: string;
}

export class CloudinaryService {
  /**
   * Check if Cloudinary is configured
   */
  isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  /**
   * Upload image to Cloudinary with optimization
   */
  async uploadImage(
    imageBytes: string,
    storyId: string,
    index: number,
    options: ImageUploadOptions = {}
  ): Promise<string> {
    if (!this.isConfigured()) {
      console.warn("[CLOUDINARY] Not configured, returning placeholder URL");
      return this.getPlaceholderUrl(storyId, index);
    }

    try {
      // Convert base64 to buffer if needed
      const imageData = imageBytes.startsWith("data:")
        ? imageBytes
        : `data:image/png;base64,${imageBytes}`;

      const transformations = this.getTransformations(options);

      const result = await cloudinary.uploader.upload(imageData, {
        folder: `stories/${storyId}/images`,
        public_id: `image-${index}`,
        resource_type: "image",
        overwrite: true,
        transformation: transformations,
      });

      return result.secure_url;
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      throw new Error("Failed to upload image");
    }
  }

  /**
   * Upload image with multiple optimized versions
   * Uses the ImageOptimizer for comprehensive optimization
   */
  async uploadImageWithVersions(
    imageBytes: string,
    storyId: string,
    index: number,
    options: ImageUploadOptions = {}
  ): Promise<ImageUploadResult> {
    if (!this.isConfigured()) {
      console.warn("[CLOUDINARY] Not configured, returning placeholder");
      const placeholderUrl = this.getPlaceholderUrl(storyId, index);
      return {
        url: placeholderUrl,
        thumbnailUrl: placeholderUrl,
        smallUrl: `https://placehold.co/400x300/e2e8f0/64748b?text=Image+${index + 1}`,
        mediumUrl: `https://placehold.co/800x600/e2e8f0/64748b?text=Image+${index + 1}`,
        largeUrl: placeholderUrl,
        bannerUrl: `https://placehold.co/1920x1080/e2e8f0/64748b?text=Banner+${index + 1}`,
        printUrl: placeholderUrl,
        blurPlaceholder: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==',
        publicId: `placeholder-${storyId}-${index}`,
        width: 1200,
        height: 800,
        bytes: 0,
        format: 'png',
      };
    }

    try {
      // Use the ImageOptimizer for comprehensive optimization
      const optimizedResult = await imageOptimizer.uploadAndOptimize(
        imageBytes,
        storyId,
        index,
        {
          generateBlurPlaceholder: options.generateBlurPlaceholder !== false,
          format: options.transformations?.format === 'auto' ? 'auto' : 
                  options.transformations?.format as 'webp' | 'avif' | 'png' | 'jpg' || 'webp',
        }
      );

      // Map OptimizedImageResult to ImageUploadResult
      const uploadResult: ImageUploadResult = {
        url: optimizedResult.optimizedUrl,
        thumbnailUrl: optimizedResult.thumbnailUrl,
        smallUrl: optimizedResult.smallUrl,
        mediumUrl: optimizedResult.mediumUrl,
        largeUrl: optimizedResult.largeUrl,
        bannerUrl: optimizedResult.bannerUrl,
        printUrl: optimizedResult.printUrl,
        blurPlaceholder: optimizedResult.blurPlaceholder,
        publicId: optimizedResult.publicId,
        width: optimizedResult.dimensions.width,
        height: optimizedResult.dimensions.height,
        bytes: optimizedResult.bytes,
        format: optimizedResult.format,
      };

      return uploadResult;
    } catch (error) {
      console.error("Error uploading image with versions:", error);
      throw new Error("Failed to upload image");
    }
  }

  /**
   * Get transformations based on options
   */
  private getTransformations(options: ImageUploadOptions): object[] {
    const target = options.target || 'web';
    const custom = options.transformations;

    if (custom) {
      return [{
        width: custom.width,
        height: custom.height,
        crop: 'limit',
        quality: custom.quality || 'auto',
        fetch_format: custom.format || 'auto',
      }];
    }

    if (target === 'print') {
      return [{
        width: 3000,
        height: 2000,
        crop: 'limit',
        quality: 100,
        fetch_format: 'png',
      }];
    }

    // Default web optimization
    return [{
      width: 1200,
      height: 800,
      crop: 'limit',
      quality: 'auto',
      fetch_format: 'auto',
    }];
  }

  /**
   * Get placeholder URL when Cloudinary is not configured
   */
  private getPlaceholderUrl(storyId: string, index: number): string {
    return `https://placehold.co/1200x800/e2e8f0/64748b?text=Story+Image+${index + 1}`;
  }

  /**
   * Upload audio to Cloudinary
   */
  async uploadAudio(
    audioData: ArrayBuffer,
    storyId: string,
    chapterIndex: number,
    language: string
  ): Promise<string> {
    try {
      // Convert ArrayBuffer to base64
      const buffer = Buffer.from(audioData);
      const base64Audio = buffer.toString("base64");
      const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;

      const result = await cloudinary.uploader.upload(audioDataUri, {
        folder: `stories/${storyId}/audio/${language}`,
        public_id: `chapter-${chapterIndex}`,
        resource_type: "video", // Cloudinary uses 'video' for audio files
        overwrite: true,
      });

      return result.secure_url;
    } catch (error) {
      console.error("Error uploading audio to Cloudinary:", error);
      throw new Error("Failed to upload audio");
    }
  }

  /**
   * Delete story assets
   */
  async deleteStoryAssets(storyId: string): Promise<void> {
    try {
      await cloudinary.api.delete_resources_by_prefix(`stories/${storyId}/`);
      await cloudinary.api.delete_folder(`stories/${storyId}`);
    } catch (error) {
      console.error("Error deleting story assets:", error);
      // Don't throw - deletion is best effort
    }
  }

  /**
   * Get optimized image URL
   */
  getOptimizedImageUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
    } = {}
  ): string {
    return cloudinary.url(publicId, {
      transformation: [
        {
          width: options.width || 1200,
          height: options.height,
          crop: "limit",
          quality: options.quality || "auto",
          fetch_format: options.format || "auto",
        },
      ],
    });
  }

  /**
   * Get WebP optimized URL for an image
   */
  getWebPUrl(publicId: string, width?: number): string {
    return this.getOptimizedImageUrl(publicId, {
      width: width || 1200,
      format: 'webp',
      quality: 85,
    });
  }

  /**
   * Generate blur placeholder URL for lazy loading
   */
  getBlurPlaceholderUrl(publicId: string): string {
    return cloudinary.url(publicId, {
      transformation: [
        {
          width: 20,
          height: 20,
          crop: "fill",
          quality: 30,
          effect: "blur:1000",
          fetch_format: "webp",
        },
      ],
    });
  }

  /**
   * Get responsive srcset for an image
   */
  getResponsiveSrcSet(
    publicId: string,
    widths: number[] = [400, 800, 1200, 1600]
  ): string {
    return widths
      .map((width) => {
        const url = this.getOptimizedImageUrl(publicId, {
          width,
          format: 'webp',
          quality: this.getQualityForWidth(width),
        });
        return `${url} ${width}w`;
      })
      .join(', ');
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
   * Get all optimized URLs for an image
   */
  getAllOptimizedUrls(publicId: string): {
    thumbnail: string;
    small: string;
    medium: string;
    large: string;
    banner: string;
    print: string;
    blurPlaceholder: string;
    srcSet: string;
  } {
    return {
      thumbnail: this.getOptimizedImageUrl(publicId, { width: 150, height: 150, format: 'webp', quality: 70 }),
      small: this.getOptimizedImageUrl(publicId, { width: 400, format: 'webp', quality: 75 }),
      medium: this.getOptimizedImageUrl(publicId, { width: 800, format: 'webp', quality: 80 }),
      large: this.getOptimizedImageUrl(publicId, { width: 1200, format: 'webp', quality: 85 }),
      banner: this.getOptimizedImageUrl(publicId, { width: 1920, format: 'webp', quality: 85 }),
      print: this.getOptimizedImageUrl(publicId, { width: 3000, format: 'png', quality: 100 }),
      blurPlaceholder: this.getBlurPlaceholderUrl(publicId),
      srcSet: this.getResponsiveSrcSet(publicId),
    };
  }
}

export const cloudinaryService = new CloudinaryService();
