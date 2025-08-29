import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { z } from "zod";

const bodySchema = z.object({
	text: z.string().min(3).max(2500),
	language: z.string().default("hi"),
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel (placeholder)

if (!ELEVENLABS_API_KEY) {
    console.warn("ELEVENLABS_API_KEY is not set. TTS API will not work.");
}

export async function POST(req: NextRequest) {
    if (!ELEVENLABS_API_KEY) {
        return NextResponse.json({ error: "TTS service is not configured." }, { status: 503 });
    }

	const parsed = bodySchema.safeParse(await req.json());
	if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
	const { text } = parsed.data;

	try {
        const client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
        const audioStream = await client.textToSpeech.convert(DEFAULT_VOICE_ID, {
            model_id: "eleven_multilingual_v2",
            text,
        });
        
        // Correctly handle the stream
        const headers = new Headers();
        headers.set("Content-Type", "audio/mpeg");
        
        const body = audioStream as unknown as BodyInit;
        return new NextResponse(body, { headers });

	} catch (error) {
		console.error("[TTS_ERROR]", error);
		return NextResponse.json({ error: "Failed to generate audio." }, { status: 500 });
	}
}