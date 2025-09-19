#!/usr/bin/env tsx

import dotenv from "dotenv";
dotenv.config();

import { SarvamTTSService } from "../lib/ai/sarvam-tts.js";

async function debugTTSText() {
  console.log("Debugging TTS text processing...");
  
  const sarvamTTS = new SarvamTTSService();
  
  const fullText = `Forget the stereotypical image of a college student glued to textbooks. Shail Jaiswal, a fourth-year university student, isn't just acing exams—he's building his future. Balancing rigorous coursework with a passion for coding, Shail has honed his technical skills and launched his own startup, Promptly AI. This isn't your average college project; it's a real-world venture poised to make waves. The path from late-night coding sessions to a thriving business is rarely easy. This is the story of Shail's relentless drive, innovative ideas, and the challenges he conquered to create Promptly AI. Prepare to be inspired by this young entrepreneur, proving that age is just a number when pursuing ambitious goals.`;
  
  console.log("Full text length:", fullText.length);
  console.log("Full text:", fullText);
  
  try {
    const result = await sarvamTTS.generateAudio({
      text: fullText,
      language: "en-IN",
      speaker: "anushka",
    });
    
    if (result.error) {
      console.log("❌ Error:", result.error);
    } else if (result.audioData) {
      console.log("✅ Success! Audio data size:", result.audioData.byteLength, "bytes");
      
      // Estimate audio duration (rough calculation)
      const estimatedDuration = result.audioData.byteLength / 16000; // rough estimate
      console.log("Estimated duration:", estimatedDuration.toFixed(2), "seconds");
    }
  } catch (error) {
    console.error("Exception:", error);
  }
}

debugTTSText().catch(console.error);