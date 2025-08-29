import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
const genAI = new GoogleGenerativeAI(apiKey);

function parseJson(text: string) {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    try {
        return JSON.parse(match ? match[1] : text);
    } catch {
        return null;
    }
}

export async function generateOptionsForStage(stageIndex: number, context: string[]): Promise<string[]> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const systemPrompt = `You help users craft life stories. For the given stage index (0-6), generate exactly 4 concise, empowering, culturally neutral textual options (max 22 words each). Use the provided context from previous selections to create relevant and evolving choices. Return a JSON array of 4 strings.`;
    const userContext = context.length > 0 ? `Previous Selections Context: ${context.join(" | ")}` : "This is the first stage.";

    const prompt = `${systemPrompt}\nStage Index: ${stageIndex}\n${userContext}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const options = parseJson(text);

    if (Array.isArray(options) && options.length === 4) {
        return options.map(String);
    }

    // Fallback parsing
    return text.split('\n').map(l => l.replace(/^[-*•\d.\s]+/, '').trim()).filter(Boolean).slice(0, 4);
}

export async function generateSummariesAndSteps(selections: string[]) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const joined = selections.join(" | ");

    const prompt = `Based on these 7 life stage choices, generate two distinct summaries and a set of actionable steps.
Input: ${joined}

Return a single JSON object with three keys:
1.  "userSummary": A concise (120-180 words), friendly, and hopeful summary of the user's life story.
2.  "psySummary": A compassionate, clinical formulation (180-260 words) for a psychiatrist, identifying themes, strengths, and potential areas for reframing.
3.  "actionableSteps": A JSON array of exactly 5 empowering, actionable micro-steps for the user under the theme "Change your story, change your life".`;

    const result = await model.generateContent(prompt);
    const data = parseJson(result.response.text());

    return {
        userSummary: data?.userSummary || "Could not generate user summary.",
        psySummary: data?.psySummary || "Could not generate psychiatrist summary.",
        actionableSteps: data?.actionableSteps || ["Reflect on your journey.", "Identify one small change.", "Practice self-compassion.", "Share your story with a trusted friend.", "Set a new intention."],
    };
}

export async function generateImagePrompt(selections: string[]): Promise<string> {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Based on the following life story selections, create a short, evocative, and visually descriptive prompt (30-40 words) for an AI image generator. The prompt should capture the emotional essence and key themes of the journey in a symbolic or metaphorical way. Focus on a single, clear scene.
Selections: ${selections.join(" | ")}
Prompt:`;
    
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
}