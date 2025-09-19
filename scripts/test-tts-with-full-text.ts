#!/usr/bin/env tsx

import dotenv from "dotenv";
dotenv.config();

async function testTTSWithFullText() {
  console.log("Testing TTS API with full text...");
  
  const fullText = `Forget the stereotypical image of a college student glued to textbooks. Shail Jaiswal, a fourth-year university student, isn't just acing exams—he's building his future. Balancing rigorous coursework with a passion for coding, Shail has honed his technical skills and launched his own startup, Promptly AI. This isn't your average college project; it's a real-world venture poised to make waves. The path from late-night coding sessions to a thriving business is rarely easy. This is the story of Shail's relentless drive, innovative ideas, and the challenges he conquered to create Promptly AI. Prepare to be inspired by this young entrepreneur, proving that age is just a number when pursuing ambitious goals.`;
  
  console.log("Testing with text length:", fullText.length);
  
  try {
    const response = await fetch('http://localhost:3000/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: fullText,
        language: "en-IN",
        speaker: "anushka",
        pitch: 0,
        pace: 1.0,
      }),
    });
    
    console.log("Response status:", response.status);
    
    if (response.ok) {
      const audioData = await response.arrayBuffer();
      console.log("✅ TTS API working");
      console.log("Audio size:", audioData.byteLength, "bytes");
      
      // Estimate duration
      const estimatedDuration = audioData.byteLength / 16000;
      console.log("Estimated duration:", estimatedDuration.toFixed(2), "seconds");
    } else {
      const errorText = await response.text();
      console.log("❌ TTS API failed:", response.status);
      console.log("Error:", errorText);
    }

  } catch (error) {
    console.error("Test failed:", error);
  }
}

testTTSWithFullText().catch(console.error);