#!/usr/bin/env tsx

import dotenv from "dotenv";
dotenv.config();

async function testBlogGenerate() {
  console.log("Testing blog-generate API endpoint...");
  
  const baseUrl = "http://localhost:3000";
  
  try {
    // Test the blog-generate endpoint
    console.log("\nTesting /api/ai/blog-generate");
    const response = await fetch(`${baseUrl}/api/ai/blog-generate`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Note: In a real test, you'd need proper authentication
      },
      body: JSON.stringify({
        prompt: "Write an engaging introduction about a person's childhood memories",
        contextHtml: "<p>This is a story about growing up in a small town.</p>",
        generationType: "introduction",
        length: "medium",
        tone: "conversational",
        storyId: "test-story-id"
      })
    });
    
    console.log("Response status:", response.status);
    console.log("Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Blog generate endpoint working");
      console.log("Generated content length:", data.generated?.length || 0);
      console.log("Sample content:", data.generated?.substring(0, 100) + "...");
    } else {
      const errorText = await response.text();
      console.log("❌ Blog generate endpoint failed");
      console.log("Error response:", errorText);
    }

  } catch (error) {
    console.error("Test failed:", error);
    console.log("\n⚠️  Make sure the Next.js dev server is running on localhost:3000");
    console.log("   Run: npm run dev");
  }
}

testBlogGenerate().catch(console.error);