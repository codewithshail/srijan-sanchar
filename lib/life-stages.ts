/**
 * Life Stage Templates System
 * 
 * This module provides utilities for managing life story stages,
 * including stage definitions, template pre-filling, and validation.
 */

// Life stage definitions with bilingual names
export const LIFE_STAGES = [
  {
    id: "childhood",
    name: "Childhood",
    nativeName: "बचपन",
    transliteration: "Bachpan",
    icon: "🧒",
    description: "Early years and formative experiences",
    index: 0,
  },
  {
    id: "teenage",
    name: "Teenage Years",
    nativeName: "किशोरावस्था",
    transliteration: "Kishoravastha",
    icon: "🎓",
    description: "Adolescence and school years",
    index: 1,
  },
  {
    id: "young_adult",
    name: "Young Adult",
    nativeName: "युवावस्था",
    transliteration: "Yuvavastha",
    icon: "🎯",
    description: "Early adulthood and finding your path",
    index: 2,
  },
  {
    id: "career_growth",
    name: "Career & Growth",
    nativeName: "करियर और विकास",
    transliteration: "Career aur Vikas",
    icon: "💼",
    description: "Professional development and achievements",
    index: 3,
  },
  {
    id: "marriage_family",
    name: "Marriage & Family",
    nativeName: "विवाह और परिवार",
    transliteration: "Vivah aur Parivar",
    icon: "👨‍👩‍👧‍👦",
    description: "Building relationships and family life",
    index: 4,
  },
  {
    id: "maturity",
    name: "Maturity",
    nativeName: "परिपक्वता",
    transliteration: "Paripakwata",
    icon: "🌟",
    description: "Life lessons and personal growth",
    index: 5,
  },
  {
    id: "wisdom_years",
    name: "Wisdom Years",
    nativeName: "अनुभव के वर्ष",
    transliteration: "Anubhav ke Varsh",
    icon: "🧘",
    description: "Reflections and legacy",
    index: 6,
  },
] as const;

export type LifeStageId = (typeof LIFE_STAGES)[number]["id"];

export interface LifeStageTemplate {
  id: string;
  stageName: string;
  content: string;
  language: string;
  updatedAt: Date;
}

export interface LifeStageContent {
  stageId: LifeStageId;
  content: string;
  language: string;
  isFromTemplate: boolean;
}

/**
 * Get stage definition by ID
 */
export function getStageById(stageId: string) {
  return LIFE_STAGES.find((stage) => stage.id === stageId);
}

/**
 * Get stage definition by index
 */
export function getStageByIndex(index: number) {
  return LIFE_STAGES.find((stage) => stage.index === index);
}

/**
 * Validate if a stage ID is valid
 */
export function isValidStageId(stageId: string): stageId is LifeStageId {
  return LIFE_STAGES.some((stage) => stage.id === stageId);
}

/**
 * Get all stage IDs
 */
export function getAllStageIds(): LifeStageId[] {
  return LIFE_STAGES.map((stage) => stage.id);
}

/**
 * Pre-fill stage content from user templates
 * 
 * This function takes existing stage content and user templates,
 * and returns the content with templates pre-filled for empty stages.
 */
export function prefillStagesFromTemplates(
  existingContent: Record<string, string>,
  templates: Record<string, { content: string; language: string }>
): Record<string, LifeStageContent> {
  const result: Record<string, LifeStageContent> = {};

  for (const stage of LIFE_STAGES) {
    const existing = existingContent[stage.id];
    const template = templates[stage.id];

    if (existing && existing.trim()) {
      // Use existing content if available
      result[stage.id] = {
        stageId: stage.id,
        content: existing,
        language: template?.language || "en",
        isFromTemplate: false,
      };
    } else if (template && template.content && template.content.trim()) {
      // Pre-fill from template if no existing content
      result[stage.id] = {
        stageId: stage.id,
        content: template.content,
        language: template.language,
        isFromTemplate: true,
      };
    } else {
      // Empty stage
      result[stage.id] = {
        stageId: stage.id,
        content: "",
        language: "en",
        isFromTemplate: false,
      };
    }
  }

  return result;
}

/**
 * Calculate completion percentage for life stages
 */
export function calculateStageCompletion(
  stageContent: Record<string, string>
): {
  completedCount: number;
  totalCount: number;
  percentage: number;
  completedStages: LifeStageId[];
} {
  const completedStages: LifeStageId[] = [];

  for (const stage of LIFE_STAGES) {
    const content = stageContent[stage.id];
    if (content && content.trim().length > 0) {
      completedStages.push(stage.id);
    }
  }

  return {
    completedCount: completedStages.length,
    totalCount: LIFE_STAGES.length,
    percentage: Math.round((completedStages.length / LIFE_STAGES.length) * 100),
    completedStages,
  };
}

/**
 * Get prompts/questions for each life stage to help users write
 */
export function getStagePrompts(stageId: LifeStageId): string[] {
  const prompts: Record<LifeStageId, string[]> = {
    childhood: [
      "What are your earliest memories?",
      "Who were the important people in your childhood?",
      "What games did you love to play?",
      "What was your favorite place as a child?",
    ],
    teenage: [
      "What were your dreams and aspirations?",
      "Who were your closest friends?",
      "What challenges did you face?",
      "What subjects or activities interested you most?",
    ],
    young_adult: [
      "What decisions shaped your path?",
      "What were your first experiences of independence?",
      "What did you learn about yourself?",
      "What relationships were meaningful?",
    ],
    career_growth: [
      "What career path did you choose and why?",
      "What achievements are you proud of?",
      "What obstacles did you overcome?",
      "Who mentored or inspired you?",
    ],
    marriage_family: [
      "How did you meet your partner?",
      "What does family mean to you?",
      "What traditions have you created?",
      "What lessons have you learned about love?",
    ],
    maturity: [
      "What life lessons have shaped your perspective?",
      "How have you grown as a person?",
      "What values guide your decisions?",
      "What would you tell your younger self?",
    ],
    wisdom_years: [
      "What legacy do you want to leave?",
      "What brings you peace and contentment?",
      "What wisdom would you share with others?",
      "What are you most grateful for?",
    ],
  };

  return prompts[stageId] || [];
}
