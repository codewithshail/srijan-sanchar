"use client";

/**
 * Hook for Optimized Image Loading
 * 
 * Provides utilities for:
 * - Progressive image loading
 * - Preloading images
 * - Tracking loading state
 * - Generating optimized URLs
 * 
 * Requirements: 6.2, 11.3
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  preloadImage,
  preloadImages,
  ProgressiveImageLoader,
  type ImageLoadingState,
  type LazyLoadOptions,
} from "@/lib/image-optimization";

/**
 * Hook for managing image loading state
 */
export function useImageLoadingState(src: string) {
  const [state, setState] = useState<ImageLoadingState>("idle");
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!src) return;

    setState("loading");
    setError(null);

    try {
      await preloadImage(src);
      setState("loaded");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err : new Error("Failed to load image"));
    }
  }, [src]);

  const reset = useCallback(() => {
    setState("idle");
    setError(null);
  }, []);

  return {
    state,
    error,
    isIdle: state === "idle",
    isLoading: state === "loading",
    isLoaded: state === "loaded",
    hasError: state === "error",
    load,
    reset,
  };
}

/**
 * Hook for progressive image loading with blur-up effect
 */
export function useProgressiveImage(
  placeholderSrc: string,
  fullSrc: string,
  options: LazyLoadOptions = {}
) {
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef<ProgressiveImageLoader | null>(null);

  useEffect(() => {
    if (!fullSrc) return;

    loaderRef.current = new ProgressiveImageLoader(placeholderSrc, fullSrc, {
      ...options,
      onLoadComplete: () => {
        setCurrentSrc(fullSrc);
        setIsLoaded(true);
        options.onLoadComplete?.();
      },
      onError: (err) => {
        setError(err);
        options.onError?.(err);
      },
    });

    loaderRef.current.load().catch(() => {
      // Error handled in callback
    });

    return () => {
      loaderRef.current = null;
    };
  }, [placeholderSrc, fullSrc, options]);

  return {
    src: currentSrc,
    isLoaded,
    error,
    isPlaceholder: currentSrc === placeholderSrc,
  };
}

/**
 * Hook for preloading multiple images
 */
export function useImagePreloader(
  srcs: string[],
  options: { autoStart?: boolean; parallel?: boolean } = {}
) {
  const { autoStart = false, parallel = true } = options;
  const [progress, setProgress] = useState({ loaded: 0, total: srcs.length });
  const [isComplete, setIsComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Error[]>([]);

  const preload = useCallback(async () => {
    if (srcs.length === 0) {
      setIsComplete(true);
      return;
    }

    setIsLoading(true);
    setProgress({ loaded: 0, total: srcs.length });
    setErrors([]);

    try {
      await preloadImages(srcs, {
        parallel,
        onProgress: (loaded, total) => {
          setProgress({ loaded, total });
        },
      });
      setIsComplete(true);
    } catch (err) {
      setErrors((prev) => [
        ...prev,
        err instanceof Error ? err : new Error("Preload failed"),
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [srcs, parallel]);

  useEffect(() => {
    if (autoStart && srcs.length > 0) {
      preload();
    }
  }, [autoStart, preload, srcs.length]);

  return {
    progress,
    isComplete,
    isLoading,
    errors,
    preload,
    percentage: srcs.length > 0 ? (progress.loaded / progress.total) * 100 : 0,
  };
}

/**
 * Hook for lazy loading images with Intersection Observer
 */
export function useLazyImage(
  src: string,
  options: LazyLoadOptions & { threshold?: number } = {}
) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  const setRef = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: options.rootMargin || "200px 0px",
        threshold: options.threshold || 0.1,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options.rootMargin, options.threshold]);

  useEffect(() => {
    if (isInView && src) {
      preloadImage(src)
        .then(() => setIsLoaded(true))
        .catch(() => {
          // Image failed to load, but we still mark as "loaded" to show error state
          setIsLoaded(true);
        });
    }
  }, [isInView, src]);

  return {
    ref: setRef,
    isInView,
    isLoaded,
    shouldLoad: isInView,
    currentSrc: isInView ? src : undefined,
  };
}

/**
 * Hook for generating Cloudinary optimized URLs
 */
export function useCloudinaryUrl(publicId: string) {
  const getUrl = useCallback(
    (options: {
      width?: number;
      height?: number;
      quality?: number | "auto";
      format?: "webp" | "avif" | "png" | "jpg" | "auto";
      crop?: "fill" | "fit" | "limit" | "scale" | "thumb";
    } = {}) => {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      if (!cloudName || !publicId) return "";

      const transformations: string[] = [];

      if (options.width) transformations.push(`w_${options.width}`);
      if (options.height) transformations.push(`h_${options.height}`);
      if (options.quality) transformations.push(`q_${options.quality}`);
      if (options.format) transformations.push(`f_${options.format}`);
      if (options.crop) transformations.push(`c_${options.crop}`);

      const transformString = transformations.length > 0
        ? `${transformations.join(",")}/`
        : "";

      return `https://res.cloudinary.com/${cloudName}/image/upload/${transformString}${publicId}`;
    },
    [publicId]
  );

  const getThumbnail = useCallback(
    (size: number = 150) =>
      getUrl({ width: size, height: size, crop: "thumb", format: "webp", quality: 70 }),
    [getUrl]
  );

  const getSmall = useCallback(
    () => getUrl({ width: 400, format: "webp", quality: 75 }),
    [getUrl]
  );

  const getMedium = useCallback(
    () => getUrl({ width: 800, format: "webp", quality: 80 }),
    [getUrl]
  );

  const getLarge = useCallback(
    () => getUrl({ width: 1200, format: "webp", quality: 85 }),
    [getUrl]
  );

  const getBanner = useCallback(
    () => getUrl({ width: 1920, format: "webp", quality: 85 }),
    [getUrl]
  );

  const getPrint = useCallback(
    () => getUrl({ width: 3000, format: "png", quality: 100 }),
    [getUrl]
  );

  return {
    getUrl,
    getThumbnail,
    getSmall,
    getMedium,
    getLarge,
    getBanner,
    getPrint,
  };
}

/**
 * Hook for responsive image srcset generation
 */
export function useResponsiveSrcSet(
  baseUrl: string,
  widths: number[] = [400, 800, 1200, 1600]
) {
  const srcSet = widths
    .map((width) => {
      // Handle Cloudinary URLs
      if (baseUrl.includes("cloudinary.com")) {
        const optimizedUrl = baseUrl.replace(
          "/upload/",
          `/upload/w_${width},f_auto,q_auto/`
        );
        return `${optimizedUrl} ${width}w`;
      }
      // Handle other URLs
      const separator = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${separator}w=${width} ${width}w`;
    })
    .join(", ");

  const sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 70vw";

  return { srcSet, sizes };
}
