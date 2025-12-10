/**
 * Audio Streaming API with Range Request Support
 * 
 * GET /api/audio/stream/[chapterId] - Stream audio chapter with range support
 * 
 * Supports:
 * - HTTP Range requests for efficient seeking
 * - Partial content responses (206)
 * - Proper caching headers
 * 
 * Requirements: 8.2, 8.3
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audioChapters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Parse Range header
 */
function parseRangeHeader(
  rangeHeader: string | null,
  fileSize: number
): { start: number; end: number } | null {
  if (!rangeHeader) return null;

  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  // Validate range
  if (start >= fileSize || end >= fileSize || start > end) {
    return null;
  }

  return { start, end };
}

/**
 * GET /api/audio/stream/[chapterId]
 * Stream audio chapter with range request support
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;

    // Fetch chapter metadata from database
    const [chapter] = await db
      .select()
      .from(audioChapters)
      .where(eq(audioChapters.id, chapterId));

    if (!chapter) {
      return NextResponse.json(
        { error: "Audio chapter not found" },
        { status: 404 }
      );
    }

    const audioUrl = chapter.audioUrl;

    // Fetch the audio file from storage
    const audioResponse = await fetch(audioUrl, {
      headers: {
        // Pass through range header if present
        ...(request.headers.get("Range") && {
          Range: request.headers.get("Range")!,
        }),
      },
    });

    if (!audioResponse.ok && audioResponse.status !== 206) {
      console.error(
        `[AUDIO_STREAM] Failed to fetch audio: ${audioResponse.status}`
      );
      return NextResponse.json(
        { error: "Failed to fetch audio file" },
        { status: 502 }
      );
    }

    const contentLength = audioResponse.headers.get("Content-Length");
    const contentRange = audioResponse.headers.get("Content-Range");
    const contentType =
      audioResponse.headers.get("Content-Type") || "audio/wav";

    // Build response headers
    const headers: HeadersInit = {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Expose-Headers":
        "Content-Length, Content-Range, Accept-Ranges",
    };

    if (contentLength) {
      headers["Content-Length"] = contentLength;
    }

    if (contentRange) {
      headers["Content-Range"] = contentRange;
    }

    // Return the audio stream
    const status = audioResponse.status === 206 ? 206 : 200;

    return new NextResponse(audioResponse.body, {
      status,
      headers,
    });
  } catch (error) {
    console.error("[AUDIO_STREAM] Error:", error);
    return NextResponse.json(
      { error: "Failed to stream audio" },
      { status: 500 }
    );
  }
}

/**
 * HEAD /api/audio/stream/[chapterId]
 * Get audio metadata without downloading content
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  try {
    const { chapterId } = await params;

    // Fetch chapter metadata from database
    const [chapter] = await db
      .select()
      .from(audioChapters)
      .where(eq(audioChapters.id, chapterId));

    if (!chapter) {
      return new NextResponse(null, { status: 404 });
    }

    // Fetch headers from storage
    const audioResponse = await fetch(chapter.audioUrl, {
      method: "HEAD",
    });

    if (!audioResponse.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const contentLength = audioResponse.headers.get("Content-Length");
    const contentType =
      audioResponse.headers.get("Content-Type") || "audio/wav";

    return new NextResponse(null, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": contentLength || "0",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Range, Content-Type",
        "Access-Control-Expose-Headers":
          "Content-Length, Content-Range, Accept-Ranges",
      },
    });
  } catch (error) {
    console.error("[AUDIO_STREAM] HEAD Error:", error);
    return new NextResponse(null, { status: 500 });
  }
}

/**
 * OPTIONS /api/audio/stream/[chapterId]
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
