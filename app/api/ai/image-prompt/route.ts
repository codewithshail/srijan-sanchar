import { NextResponse } from "next/server"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"

export async function POST(request: Request) {
  try {
    const { title, content } = await request.json()

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json({ prompt: `A warm, evocative scene for: ${title}` })
    }

    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      system: "Return a concise photorealistic prompt for an inspirational story image.",
      prompt: `Title: ${title}\nStory content: ${content}\nOutput only the prompt.`,
    })
    return NextResponse.json({ prompt: text.trim() })
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
