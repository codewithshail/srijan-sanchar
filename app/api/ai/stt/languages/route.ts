/**
 * STT Languages API Route
 * Returns list of supported languages for speech-to-text
 */

import { NextResponse } from "next/server";
import { SUPPORTED_STT_LANGUAGES, sttService } from "@/lib/ai";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_STT_LANGUAGES,
    configured: sttService.isConfigured(),
    defaultLanguage: "en-IN",
  });
}
