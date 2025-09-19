import { NextRequest, NextResponse } from "next/server";
import { sarvamTTS, SUPPORTED_LANGUAGES } from "@/lib/ai/sarvam-tts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

const bodySchema = z.object({
	text: z.string().min(3).max(10000), // Increased limit for full stories
	language: z.string().min(2).max(50),
	speaker: z.string().optional().default("anushka"),
	pitch: z.number().min(-20).max(20).optional().default(0),
	pace: z.number().min(0.25).max(4.0).optional().default(1.0),
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) console.warn("GEMINI_API_KEY not set.");

// Helper function to split text into chunks for translation
function splitTextIntoChunks(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = "";
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    // If adding this sentence would exceed the chunk size, start a new chunk
    if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // If no chunks were created (e.g., very long single sentence), split by character count
  if (chunks.length === 0 && text.length > 0) {
    for (let i = 0; i < text.length; i += maxChunkSize) {
      chunks.push(text.slice(i, i + maxChunkSize));
    }
  }
  
  return chunks;
}

export async function POST(req: NextRequest) {
    if (!sarvamTTS.isConfigured() || !GEMINI_API_KEY) {
        return NextResponse.json({ error: "Service is not configured." }, { status: 503 });
    }

	const parsed = bodySchema.safeParse(await req.json());
	if (!parsed.success) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
	let { text, language, speaker, pitch, pace } = parsed.data;

	try {
        // Map language name to language code
        let languageCode = "en-IN"; // default
        const supportedLang = SUPPORTED_LANGUAGES.find(
            lang => lang.name.toLowerCase() === language.toLowerCase() || 
                   lang.nativeName === language ||
                   lang.code === language
        );
        
        if (supportedLang) {
            languageCode = supportedLang.code;
        }

        // If the language is not English and we need translation
        if (languageCode !== "en-IN" && language.toLowerCase() !== 'english') {
            const targetLanguageName = supportedLang?.name || language;
            console.log("[TRANSLATE_TTS] Translating to:", targetLanguageName);
            
            const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            
            // For very long text, split into chunks
            if (text.length > 3000) {
                console.log("[TRANSLATE_TTS] Long text detected, chunking for translation");
                const chunks = splitTextIntoChunks(text, 2000);
                const translatedChunks = [];
                
                for (const chunk of chunks) {
                    const prompt = `Translate the following English text to ${targetLanguageName}. Maintain the original meaning and context. Return only the translated text, nothing else:\n\n${chunk}`;
                    const result = await model.generateContent(prompt);
                    translatedChunks.push(result.response.text());
                }
                
                text = translatedChunks.join(' ');
            } else {
                const prompt = `Translate the following English text to ${targetLanguageName}. Maintain the original meaning and context. Return only the translated text, nothing else:\n\n${text}`;
                const result = await model.generateContent(prompt);
                text = result.response.text();
            }
            
            console.log("[TRANSLATE_TTS] Translation completed, length:", text.length);
        }

        const result = await sarvamTTS.generateAudio({
            text,
            language: languageCode,
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
        headers.set("Cache-Control", "public, max-age=3600");
        
        return new NextResponse(result.audioData, { headers });

	} catch (error) {
		console.error("[TRANSLATE_TTS_ERROR]", error);
		return NextResponse.json({ error: "Failed to generate audio." }, { status: 500 });
	}
}