#!/usr/bin/env tsx

import dotenv from "dotenv";
dotenv.config();

async function testTTSAPI() {
  console.log("Testing TTS API endpoints...");
  
  const baseUrl = "http://localhost:3000";
  
  try {
    // Test 1: Get supported languages
    console.log("\n1. Testing /api/tts/languages");
    const langResponse = await fetch(`${baseUrl}/api/tts/languages`);
    if (langResponse.ok) {
      const langData = await langResponse.json();
      console.log("   ✅ Languages endpoint working");
      console.log("   Languages count:", langData.total);
      console.log("   Sample languages:", langData.languages.slice(0, 3).map((l: any) => l.nativeName).join(", "));
    } else {
      console.log("   ❌ Languages endpoint failed:", langResponse.status);
    }

    // Test 2: Generate short audio
    console.log("\n2. Testing /api/tts (short audio)");
    const ttsResponse = await fetch(`${baseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: "Hello, this is a test message in English.",
        language: "en-IN",
        speaker: "anushka"
      })
    });
    
    if (ttsResponse.ok) {
      const audioData = await ttsResponse.arrayBuffer();
      console.log("   ✅ TTS endpoint working");
      console.log("   Audio size:", audioData.byteLength, "bytes");
      console.log("   Content-Type:", ttsResponse.headers.get('content-type'));
    } else {
      const errorText = await ttsResponse.text();
      console.log("   ❌ TTS endpoint failed:", ttsResponse.status);
      console.log("   Error:", errorText);
    }

    // Test 3: Test Hindi audio
    console.log("\n3. Testing Hindi TTS");
    const hindiResponse = await fetch(`${baseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: "नमस्ते, यह एक परीक्षण संदेश है।",
        language: "hi-IN",
        speaker: "anushka"
      })
    });
    
    if (hindiResponse.ok) {
      const audioData = await hindiResponse.arrayBuffer();
      console.log("   ✅ Hindi TTS working");
      console.log("   Audio size:", audioData.byteLength, "bytes");
    } else {
      const errorText = await hindiResponse.text();
      console.log("   ❌ Hindi TTS failed:", hindiResponse.status);
      console.log("   Error:", errorText);
    }

  } catch (error) {
    console.error("Test failed:", error);
    console.log("\n⚠️  Make sure the Next.js dev server is running on localhost:3000");
    console.log("   Run: npm run dev");
  }
}

testTTSAPI().catch(console.error);