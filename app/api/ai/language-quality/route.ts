/**
 * Language Quality Testing API
 * 
 * Provides endpoints for testing STT accuracy, TTS quality,
 * and translation quality for all supported Indian languages.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getLanguageQualityInfo,
  getLanguageSupportStatus,
  getTestPhrases,
  validateTranslation,
  calculateWER,
  calculateCER,
  werToAccuracy,
} from "@/lib/i18n/language-quality";
import { locales, type Locale, isValidLocale } from "@/lib/i18n/config";
import { sarvamTTS } from "@/lib/ai/sarvam-tts";
import { TTS_LANGUAGE_CODES } from "@/lib/i18n/language-quality";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET: Get language quality information and support status
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "info";
  const locale = searchParams.get("locale");

  try {
    switch (action) {
      case "info":
        // Return quality info for all languages
        return NextResponse.json({
          languages: getLanguageQualityInfo(),
          supportStatus: getLanguageSupportStatus(),
        });

      case "test-phrases":
        // Return test phrases for a specific language
        if (!locale || !isValidLocale(locale)) {
          return NextResponse.json(
            { error: "Valid locale parameter required" },
            { status: 400 }
          );
        }
        return NextResponse.json({
          locale,
          phrases: getTestPhrases(locale as Locale),
        });

      case "support-status":
        return NextResponse.json({
          status: getLanguageSupportStatus(),
        });

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[LANGUAGE_QUALITY_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get language quality info" },
      { status: 500 }
    );
  }
}

/**
 * POST: Test specific language features
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, locale, text, sourceLocale, targetLocale, translatedText } = body;

    switch (action) {
      case "test-tts":
        // Test TTS for a specific language
        if (!locale || !isValidLocale(locale)) {
          return NextResponse.json(
            { error: "Valid locale required" },
            { status: 400 }
          );
        }

        const testText = text || getTestPhrases(locale as Locale)[0];
        const ttsCode = TTS_LANGUAGE_CODES[locale as Locale];

        if (!sarvamTTS.isConfigured()) {
          return NextResponse.json({
            locale,
            success: false,
            error: "TTS service not configured",
            configured: false,
          });
        }

        const startTime = Date.now();
        const ttsResult = await sarvamTTS.generateAudio({
          text: testText,
          language: ttsCode,
        });
        const generationTime = Date.now() - startTime;

        if (ttsResult.error) {
          return NextResponse.json({
            locale,
            success: false,
            error: ttsResult.error,
            generationTime,
          });
        }

        return NextResponse.json({
          locale,
          success: true,
          inputText: testText,
          audioSize: ttsResult.audioData?.byteLength || 0,
          generationTime,
          ttsCode,
        });

      case "validate-translation":
        // Validate translation quality
        if (!sourceLocale || !targetLocale || !text || !translatedText) {
          return NextResponse.json(
            { error: "sourceLocale, targetLocale, text, and translatedText required" },
            { status: 400 }
          );
        }

        if (!isValidLocale(targetLocale)) {
          return NextResponse.json(
            { error: "Invalid target locale" },
            { status: 400 }
          );
        }

        const validation = validateTranslation(
          text,
          translatedText,
          targetLocale as Locale
        );

        return NextResponse.json({
          sourceLocale,
          targetLocale,
          sourceText: text,
          translatedText,
          validation,
        });

      case "calculate-accuracy":
        // Calculate STT accuracy metrics
        const { reference, hypothesis } = body;
        if (!reference || !hypothesis) {
          return NextResponse.json(
            { error: "reference and hypothesis text required" },
            { status: 400 }
          );
        }

        const wer = calculateWER(reference, hypothesis);
        const cer = calculateCER(reference, hypothesis);
        const accuracy = werToAccuracy(wer);

        return NextResponse.json({
          reference,
          hypothesis,
          metrics: {
            wordErrorRate: wer,
            characterErrorRate: cer,
            accuracy,
          },
        });

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[LANGUAGE_QUALITY_API] Error:", error);
    return NextResponse.json(
      { error: "Failed to test language quality" },
      { status: 500 }
    );
  }
}
