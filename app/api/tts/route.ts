import { NextRequest, NextResponse } from "next/server";
import { sarvamTTS } from "@/lib/ai/sarvam-tts";
import { z } from "zod";

const bodySchema = z.object({
	text: z.string().min(3).max(5000),
	language: z.string().default("hi-IN"),
	speaker: z.string().optional().default("anushka"),
	pitch: z.number().min(-20).max(20).optional().default(0),
	pace: z.number().min(0.25).max(4.0).optional().default(1.0),
});

export async function POST(req: NextRequest) {
    if (!sarvamTTS.isConfigured()) {
        return NextResponse.json({ error: "TTS service is not configured." }, { status: 503 });
    }

	const parsed = bodySchema.safeParse(await req.json());
	if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
	const { text, language, speaker, pitch, pace } = parsed.data;

	console.log('[TTS_API] Received text length:', text.length);
	console.log('[TTS_API] Received text preview:', text.substring(0, 200) + '...');
	console.log('[TTS_API] Language:', language);

	try {
        const result = await sarvamTTS.generateAudio({
            text,
            language,
            speaker,
            pitch,
            pace,
        });
        
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
        
        if (!result.audioData) {
            return NextResponse.json({ error: "No audio data received" }, { status: 500 });
        }
        
        const headers = new Headers();
        headers.set("Content-Type", "audio/wav");
        headers.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
        
        return new NextResponse(result.audioData, { headers });

	} catch (error) {
		console.error("[TTS_ERROR]", error);
		return NextResponse.json({ error: "Failed to generate audio." }, { status: 500 });
	}
}