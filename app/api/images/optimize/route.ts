/**
 * Image Optimization API
 * 
 * Provides endpoints for:
 * - Optimizing existing images
 * - Generating multiple size variants
 * - Creating blur placeholders
 * 
 * Requirements: 6.2, 11.3
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { imageOptimizer, type ImageOptimizationOptions } from "@/lib/image-optimization";
import { cloudinaryService } from "@/lib/storage/cloudinary";

/**
 * POST /api/images/optimize
 * Optimize an image and generate multiple size variants
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { imageUrl, publicId, storyId, options } = body as {
      imageUrl?: string;
      publicId?: string;
      storyId?: string;
      options?: ImageOptimizationOptions;
    };

    // Validate input
    if (!imageUrl && !publicId) {
      return NextResponse.json(
        { error: "Either imageUrl or publicId is required" },
        { status: 400 }
      );
    }

    // If we have a publicId, generate all optimized URLs
    if (publicId) {
      const optimizedUrls = cloudinaryService.getAllOptimizedUrls(publicId);
      
      return NextResponse.json({
        success: true,
        data: {
          publicId,
          ...optimizedUrls,
        },
      });
    }

    // If we have an imageUrl, compress and optimize it
    if (imageUrl) {
      const compressedUrl = await imageOptimizer.compressImage(imageUrl, {
        width: options?.width || 1200,
        height: options?.height,
        quality: options?.quality || 85,
        format: options?.format || 'webp',
        crop: options?.crop || 'limit',
      });

      // Generate blur placeholder
      let blurPlaceholder: string | undefined;
      if (options?.generateBlurPlaceholder !== false) {
        // For external URLs, we can't easily generate blur placeholder
        // Return a generic one
        blurPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2UyZThmMCIvPjwvc3ZnPg==';
      }

      return NextResponse.json({
        success: true,
        data: {
          originalUrl: imageUrl,
          optimizedUrl: compressedUrl,
          blurPlaceholder,
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[IMAGE_OPTIMIZE_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to optimize image" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/images/optimize
 * Get optimized URLs for an image by publicId
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const publicId = searchParams.get("publicId");
    const width = searchParams.get("width");
    const format = searchParams.get("format") as 'webp' | 'avif' | 'png' | 'jpg' | null;

    if (!publicId) {
      return NextResponse.json(
        { error: "publicId is required" },
        { status: 400 }
      );
    }

    // If specific width is requested, return single optimized URL
    if (width) {
      const optimizedUrl = imageOptimizer.getOptimizedUrl(publicId, {
        width: parseInt(width, 10),
        format: format || 'webp',
      });

      return NextResponse.json({
        success: true,
        data: {
          url: optimizedUrl,
        },
      });
    }

    // Return all optimized URLs
    const optimizedUrls = cloudinaryService.getAllOptimizedUrls(publicId);

    return NextResponse.json({
      success: true,
      data: {
        publicId,
        ...optimizedUrls,
      },
    });
  } catch (error) {
    console.error("[IMAGE_OPTIMIZE_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get optimized URLs" },
      { status: 500 }
    );
  }
}
