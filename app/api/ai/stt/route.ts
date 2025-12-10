/**
 * Speech-to-Text API Route
 * Handles audio transcription using Google Cloud Speech-to-Text
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sttService, SUPPORTED_STT_LANGUAGES } from "@/lib/ai";
import { 
  checkRateLimit, 
  recordRateLimitedRequest,
  getRateLimitErrorResponse 
} from "@/lib/rate-limiting";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET: Return supported languages
export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_STT_LANGUAGES,
    configured: sttService.isConfigured(),
  });
}

// POST: Transcribe audio
export async function POST(request: NextRequest) {
  try {
    // Check rate limit for STT requests
    const { allowed, result } = await checkRateLimit(request, "stt");
    if (!allowed && result) {
      return getRateLimitErrorResponse(result);
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Record the request after successful auth
    await recordRateLimitedRequest(request, "stt");

    // Check if service is configured
    if (!sttService.isConfigured()) {
      return NextResponse.json(
        {
          error: "Speech-to-text service is not configured. Please use browser's speech recognition.",
          fallbackToBrowser: true,
        },
        { status: 503 }
      );
    }

    // Parse form data (audio file)
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const language = formData.get("language") as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (!language) {
      return NextResponse.json(
        { error: "Language code is required" },
        { status: 400 }
      );
    }

    // Validate language
    if (!sttService.isLanguageSupported(language)) {
      return NextResponse.json(
        {
          error: `Language '${language}' is not supported`,
          supportedLanguages: SUPPORTED_STT_LANGUAGES.map((l) => l.code),
        },
        { status: 400 }
      );
    }

    // Convert File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], {
      type: audioFile.type,
    });

    // Transcribe
    const transcriptionResult = await sttService.transcribe({
      audioBlob,
      language,
      enableAutoPunctuation: true,
    });

    if (transcriptionResult.error) {
      return NextResponse.json(
        { error: transcriptionResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      transcript: transcriptionResult.transcript,
      confidence: transcriptionResult.confidence,
      language,
    });
  } catch (error) {
    console.error("[STT_API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Transcription failed",
      },
      { status: 500 }
    );
  }
}
