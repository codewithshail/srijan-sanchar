"use client";

/**
 * Optimized Image Component
 * 
 * A React component that provides:
 * - Lazy loading with Intersection Observer
 * - Blur-up placeholder effect
 * - Responsive srcset generation
 * - WebP format with fallback
 * - Proper aspect ratio handling
 * 
 * Requirements: 6.2, 11.3
 */

import * as React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  createLazyLoadObserver,
  getLoadingAttribute,
  getFetchPriority,
  generateBlurDataUrl,
  type LazyLoadOptions,
  type ImageLoadingState,
} from "@/lib/image-optimization";

export interface OptimizedImageProps {
  /** Image source URL */
  src: string;
  /** Alternative text for accessibility */
  alt: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** CSS class name */
  className?: string;
  /** Container class name */
  containerClassName?: string;
  /** Loading priority */
  priority?: "high" | "low" | "auto";
  /** Blur placeholder data URL */
  blurDataUrl?: string;
  /** Whether to show blur placeholder */
  showBlurPlaceholder?: boolean;
  /** Placeholder color (used if no blurDataUrl) */
  placeholderColor?: string;
  /** Responsive sizes attribute */
  sizes?: string;
  /** Srcset for responsive images */
  srcSet?: string;
  /** Object fit style */
  objectFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
  /** Object position style */
  objectPosition?: string;
  /** Aspect ratio (e.g., "16/9", "4/3", "1/1") */
  aspectRatio?: string;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback on load error */
  onError?: (error: Error) => void;
  /** Lazy load options */
  lazyLoadOptions?: LazyLoadOptions;
  /** Whether to fill the container */
  fill?: boolean;
  /** Quality hint for the image */
  quality?: number;
}

/**
 * Optimized Image Component with lazy loading and blur-up effect
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  containerClassName,
  priority = "auto",
  blurDataUrl,
  showBlurPlaceholder = true,
  placeholderColor = "#e2e8f0",
  sizes,
  srcSet,
  objectFit = "cover",
  objectPosition = "center",
  aspectRatio,
  onLoad,
  onError,
  lazyLoadOptions,
  fill = false,
  quality,
}: OptimizedImageProps) {
  const [loadingState, setLoadingState] = useState<ImageLoadingState>("idle");
  const [isInView, setIsInView] = useState(priority === "high");
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate blur placeholder if not provided
  const placeholder = blurDataUrl || generateBlurDataUrl(10, 10, placeholderColor);

  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (priority === "high" || !containerRef.current) {
      setIsInView(true);
      return;
    }

    const observer = createLazyLoadObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer?.disconnect();
          }
        });
      },
      lazyLoadOptions
    );

    if (observer && containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer?.disconnect();
    };
  }, [priority, lazyLoadOptions]);

  // Handle image load
  const handleLoad = useCallback(() => {
    setLoadingState("loaded");
    onLoad?.();
  }, [onLoad]);

  // Handle image error
  const handleError = useCallback(() => {
    setLoadingState("error");
    onError?.(new Error(`Failed to load image: ${src}`));
  }, [src, onError]);

  // Start loading when in view
  useEffect(() => {
    if (isInView && loadingState === "idle") {
      setLoadingState("loading");
    }
  }, [isInView, loadingState]);

  const isLoaded = loadingState === "loaded";
  const isLoading = loadingState === "loading";
  const hasError = loadingState === "error";

  // Container styles
  const containerStyles: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    ...(aspectRatio && { aspectRatio }),
    ...(fill && { width: "100%", height: "100%" }),
  };

  // Image styles
  const imageStyles: React.CSSProperties = {
    objectFit,
    objectPosition,
    transition: "opacity 0.3s ease-in-out, filter 0.3s ease-in-out",
    opacity: isLoaded ? 1 : 0,
    ...(fill && {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
    }),
  };

  // Placeholder styles
  const placeholderStyles: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit,
    objectPosition,
    filter: "blur(20px)",
    transform: "scale(1.1)",
    transition: "opacity 0.3s ease-in-out",
    opacity: isLoaded ? 0 : 1,
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative", containerClassName)}
      style={containerStyles}
    >
      {/* Blur placeholder */}
      {showBlurPlaceholder && !hasError && (
        <img
          src={placeholder}
          alt=""
          aria-hidden="true"
          style={placeholderStyles}
          className="pointer-events-none select-none"
        />
      )}

      {/* Main image */}
      {isInView && !hasError && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          srcSet={srcSet}
          sizes={sizes}
          loading={getLoadingAttribute(priority)}
          fetchPriority={getFetchPriority(priority)}
          decoding={priority === "high" ? "sync" : "async"}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            isLoading && "opacity-0",
            className
          )}
          style={imageStyles}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted"
          role="img"
          aria-label={`Failed to load: ${alt}`}
        >
          <div className="text-center text-muted-foreground p-4">
            <svg
              className="w-8 h-8 mx-auto mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs">Image unavailable</span>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

/**
 * Responsive Image Component
 * Automatically generates srcset for different screen sizes
 */
export interface ResponsiveImageProps extends Omit<OptimizedImageProps, "srcSet" | "sizes"> {
  /** Base URL for generating srcset */
  baseUrl: string;
  /** Widths to generate in srcset */
  widths?: number[];
  /** Custom sizes attribute */
  sizes?: string;
  /** URL generator function */
  urlGenerator?: (baseUrl: string, width: number) => string;
}

export function ResponsiveImage({
  baseUrl,
  widths = [400, 800, 1200, 1600],
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 70vw",
  urlGenerator,
  ...props
}: ResponsiveImageProps) {
  // Default URL generator for Cloudinary
  const defaultUrlGenerator = (url: string, width: number): string => {
    // If it's a Cloudinary URL, add width transformation
    if (url.includes("cloudinary.com")) {
      return url.replace("/upload/", `/upload/w_${width},f_auto,q_auto/`);
    }
    // For other URLs, append width as query param
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}w=${width}`;
  };

  const generator = urlGenerator || defaultUrlGenerator;

  const srcSet = widths
    .map((width) => `${generator(baseUrl, width)} ${width}w`)
    .join(", ");

  return (
    <OptimizedImage
      {...props}
      src={generator(baseUrl, widths[widths.length - 1])}
      srcSet={srcSet}
      sizes={sizes}
    />
  );
}

/**
 * Story Image Component
 * Optimized for story content images
 */
export interface StoryImageProps {
  /** Image URL */
  src: string;
  /** Alt text */
  alt: string;
  /** Caption for the image */
  caption?: string;
  /** Blur placeholder */
  blurDataUrl?: string;
  /** CSS class name */
  className?: string;
  /** Whether this is a priority image (above the fold) */
  priority?: boolean;
}

export function StoryImage({
  src,
  alt,
  caption,
  blurDataUrl,
  className,
  priority = false,
}: StoryImageProps) {
  return (
    <figure className={cn("my-6 md:my-8", className)}>
      <div className="relative w-full overflow-hidden rounded-lg shadow-lg">
        <OptimizedImage
          src={src}
          alt={alt}
          blurDataUrl={blurDataUrl}
          priority={priority ? "high" : "low"}
          aspectRatio="16/9"
          fill
          containerClassName="aspect-video"
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
        />
      </div>
      {caption && (
        <figcaption className="text-center text-sm text-muted-foreground mt-2 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/**
 * Thumbnail Image Component
 * Optimized for small preview images
 */
export interface ThumbnailImageProps {
  /** Image URL */
  src: string;
  /** Alt text */
  alt: string;
  /** Size in pixels */
  size?: number;
  /** CSS class name */
  className?: string;
  /** Whether image is rounded */
  rounded?: boolean;
}

export function ThumbnailImage({
  src,
  alt,
  size = 64,
  className,
  rounded = false,
}: ThumbnailImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={size}
      height={size}
      priority="low"
      showBlurPlaceholder={false}
      objectFit="cover"
      className={cn(
        rounded && "rounded-full",
        !rounded && "rounded-md",
        className
      )}
      containerClassName={cn(
        "flex-shrink-0",
        rounded && "rounded-full",
        !rounded && "rounded-md"
      )}
    />
  );
}
