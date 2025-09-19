import { generateText } from "ai";
import { google } from "@ai-sdk/google";

function hasAIKey() {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export async function generateOptionsForStage(
  stageIndex: number,
  previousSelections: string[]
) {
  if (!hasAIKey()) {
    const presets = [
      ["Warm family moments", "Curiosity and play", "First friends"],
      ["School adventures", "Learning challenges", "Favorite teacher"],
      ["Identity search", "Close friendships", "First heartbreak"],
      ["Career beginnings", "Moving to a new city", "Deepening relationships"],
      ["Parenthood", "Career milestones", "Balancing responsibilities"],
      ["Reflection", "Reinvention", "Letting go"],
      ["Wisdom sharing", "Gratitude", "Legacy building"],
    ];
    return (
      presets[stageIndex] ?? [
        "Meaningful moments",
        "Key challenges",
        "Growth lessons",
      ]
    );
  }

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    system:
      "You generate 3 concise, distinct life-stage options. No numbering, return as lines.",
    prompt: `Stage index ${stageIndex}. Previous: ${previousSelections.join(
      " | "
    )}`,
  });

  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function generateSummariesAndSteps(selections: string[]) {
  if (!hasAIKey()) {
    const joined = selections.join(". ");
    return {
      userSummary: `Your journey: ${joined}.`,
      psySummary: `Themes observed: resilience, connection, growth.`,
      actionableSteps: [
        "Practice daily reflection",
        "Reach out to a supportive friend",
        "Set a small weekly goal",
      ],
    };
  }

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    system: "Summarize empathetically and create actionable steps.",
    prompt: `Create two summaries (user-focused and clinical) and 3-5 action steps from: ${selections.join(
      " | "
    )}`,
  });

  const parts = text.split("\n").filter(Boolean);
  const userSummary = parts.slice(0, Math.ceil(parts.length / 2)).join("\n");
  const psySummary = parts.slice(Math.ceil(parts.length / 2)).join("\n");
  return {
    userSummary,
    psySummary,
    actionableSteps: ["Reflect weekly", "Practice breathing", "Journaling"],
  };
}

export async function generateFullStory(selections: string[], pages: number) {
  if (!hasAIKey()) {
    return (
      selections.map((s, i) => `Chapter ${i + 1}: ${s}\n\n`).join("") +
      "Closing reflections."
    );
  }

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    system: "Write a cohesive, compassionate life story.",
    prompt: `Write a ${pages}-page narrative weaving: ${selections.join(
      " | "
    )}`,
  });

  return text;
}

export async function generateImagePrompt(selections: string[]) {
  return `An evocative, warm image representing: ${selections
    .slice(-3)
    .join(", ")}`;
}
