import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { 
  checkRateLimit, 
  recordRateLimitedRequest,
  getRateLimitErrorResponse 
} from "@/lib/rate-limiting";

const bodySchema = z.object({
  text: z.string().min(1),
  contextHtml: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Check rate limit for AI requests
    const { allowed, result } = await checkRateLimit(req, "ai");
    if (!allowed && result) {
      return getRateLimitErrorResponse(result);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const { text, contextHtml } = parsed.data;

    // Record the request
    await recordRateLimitedRequest(req, "ai");

    const model = google("gemini-1.5-flash");
    const prompt = `You are an expert writing assistant. 
Improve the grammar and clarity of the provided text while preserving the author's voice. 
Then add 1-2 sentences that naturally extend the idea. 
Return only the improved text, without markdown or commentary.

Context (HTML may include headings and images, use it only to keep tone and topic consistent):
${contextHtml ?? "(no additional context)"}

Original:
${text}`;

    const { text: improved } = await generateText({ model, prompt });
    return NextResponse.json({ improved: improved?.trim() });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "AI Assist failed" },
      { status: 500 }
    );
  }
}
