import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const bodySchema = z.object({
	text: z.string().min(3).max(5000),
	language: z.string().min(2).max(50),
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

if (!ELEVENLABS_API_KEY) console.warn("ELEVENLABS_API_KEY not set.");
if (!GEMINI_API_KEY) console.warn("GEMINI_API_KEY not set.");

export async function POST(req: NextRequest) {
    if (!ELEVENLABS_API_KEY || !GEMINI_API_KEY) {
        return NextResponse.json({ error: "Service is not configured." }, { status: 503 });
    }

	const parsed = bodySchema.safeParse(await req.json());
	if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
	let { text, language } = parsed.data;

	try {
        if (language.toLowerCase() !== 'english') {
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const prompt = `Translate the following English text to ${language}. Return only the translated text, nothing else:\n\n${text}`;
            const result = await model.generateContent(prompt);
            text = result.response.text();
        }

        const client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
        const audioStream = await client.textToSpeech.convert(DEFAULT_VOICE_ID, {
            model_id: "eleven_multilingual_v2",
            text,
        });
        
        const headers = new Headers();
        headers.set("Content-Type", "audio/mpeg");
        
        return new NextResponse(audioStream as unknown as BodyInit, { headers });

	} catch (error) {
		console.error("[TRANSLATE_TTS_ERROR]", error);
		return NextResponse.json({ error: "Failed to generate audio." }, { status: 500 });
	}
}