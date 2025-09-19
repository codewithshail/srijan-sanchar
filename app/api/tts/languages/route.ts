import { NextResponse } from "next/server";
import { SUPPORTED_LANGUAGES } from "@/lib/ai/sarvam-tts";

export async function GET() {
  return NextResponse.json({
    languages: SUPPORTED_LANGUAGES,
    total: SUPPORTED_LANGUAGES.length,
  });
}