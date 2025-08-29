import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
const genAI = new GoogleGenerativeAI(apiKey);

function parseJson(text: string) {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    try {
        return JSON.parse(match ? match[1] : text);
    } catch {
        // Fallback for non-JSON or malformed JSON
        console.error("JSON parsing failed for:", text);
        return null;
    }
}

export async function generateOptionsForStage(stageIndex: number, context: string[]): Promise<string[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const systemPrompt = `You help users craft life stories, with a focus on an Indian cultural context. For the given stage index, generate exactly 4 concise options (max 22 words each) in simple, normal English.
The options must reflect a range of experiences, including positive, neutral, and challenging life events that are relatable in India. Avoid complex jargon or overly academic language.
Return a JSON array of 4 strings.

Example for Stage 0 (Ages 0-6):
- "My family was very loving and supportive."
- "We didn't have much money, but we were happy."
- "My parents were very busy, so I spent a lot of time with my grandparents."
- "I was often sick as a young child."
`;

    const userContext = context.length > 0 ? `Previous Selections Context: ${context.join(" | ")}` : "This is the first stage.";
    const prompt = `${systemPrompt}\nStage Index: ${stageIndex}\n${userContext}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const options = parseJson(text);

    if (Array.isArray(options) && options.length === 4) {
        return options.map(String);
    }

    // Fallback parsing if JSON fails
    return text.split('\n').map(l => l.replace(/^[-*•\d.\s]+/, '').trim()).filter(Boolean).slice(0, 4);
}


export async function generateSummariesAndSteps(selections: string[]) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const joined = selections.join(" | ");

    const prompt = `Based on these 7 life stage choices, generate two distinct summaries and a set of actionable steps. The tone should be hopeful and empowering.
Input: ${joined}

Return a single JSON object with three keys:
1.  "userSummary": A concise (150-200 words), friendly, first-person summary of the user's life story.
2.  "psySummary": A compassionate, clinical formulation (200-280 words) for a psychiatrist, identifying themes, strengths, and potential areas for reframing.
3.  "actionableSteps": A JSON array of exactly 5 empowering, actionable micro-steps for the user under the theme "Change your story, change your life".`;

    const result = await model.generateContent(prompt);
    const data = parseJson(result.response.text());

    return {
        userSummary: data?.userSummary || "Could not generate user summary.",
        psySummary: data?.psySummary || "Could not generate psychiatrist summary.",
        actionableSteps: data?.actionableSteps || ["Reflect on your journey.", "Identify one small change.", "Practice self-compassion.", "Share your story with a trusted friend.", "Set a new intention."],
    };
}

export async function generateFullStory(selections: string[], pageCount: number): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const joined = selections.join(" | ");
    const wordCount = pageCount * 250; // Approx 250 words per page

    const prompt = `Based on these 7 life stage choices, write a compelling, chapter-based life story in the first person ("I...").
The story should be approximately ${wordCount} words long.
Each stage should be a new chapter with a simple heading (e.g., "Chapter 1: The Early Years").
Weave the user's choices into a cohesive and engaging narrative. Expand on the choices to create a vivid and emotional journey.

User's Choices:
${joined}

Begin the story now.`;
    
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}


export async function generateImagePrompt(selections: string[]): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Based on the following life story selections, create a short, evocative, and visually descriptive prompt (30-40 words) for an AI image generator. The prompt should capture the emotional essence and key themes of the journey in a symbolic or metaphorical way. Focus on a single, clear scene with an Indian cultural feel.
Selections: ${selections.join(" | ")}
Prompt:`;
    
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}