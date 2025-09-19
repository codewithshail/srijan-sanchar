#!/usr/bin/env tsx

import dotenv from "dotenv";
dotenv.config();

import { SarvamTTSService } from "../lib/ai/sarvam-tts.js";

async function testSarvamTTS() {
  console.log("Testing Sarvam AI TTS Service...");
  console.log("Environment SARVAM_API_KEY:", process.env.SARVAM_API_KEY ? "SET" : "NOT SET");
  console.log("API Key length:", process.env.SARVAM_API_KEY?.length || 0);
  
  // Create a new instance after env vars are loaded
  const sarvamTTS = new SarvamTTSService();
  
  // Test 1: Check if service is configured
  console.log("1. Service configured:", sarvamTTS.isConfigured());
  
  // Test 2: Get supported languages
  const languages = sarvamTTS.getSupportedLanguages();
  console.log("2. Supported languages:", languages.length);
  console.log("   Languages:", languages.map(l => `${l.nativeName} (${l.code})`).join(", "));
  
  // Test 3: Check language support
  console.log("3. Hindi supported:", sarvamTTS.isLanguageSupported("hi-IN"));
  console.log("   English supported:", sarvamTTS.isLanguageSupported("en-IN"));
  console.log("   Invalid language:", sarvamTTS.isLanguageSupported("xx-XX"));
  
  // Test 4: Generate audio (only if API key is available)
  if (sarvamTTS.isConfigured()) {
    console.log("4. Testing audio generation...");
    try {
      const result = await sarvamTTS.generateAudio({
        text: "Hello, this is a test message.",
        language: "en-IN",
        speaker: "anushka",
      });
      
      if (result.error) {
        console.log("   Error:", result.error);
      } else if (result.audioData) {
        console.log("   Success! Audio data size:", result.audioData.byteLength, "bytes");
      }
    } catch (error) {
      console.log("   Exception:", error);
    }
  } else {
    console.log("4. Skipping audio generation test (no API key)");
  }
  
  console.log("Test completed!");
}

testSarvamTTS().catch(console.error);