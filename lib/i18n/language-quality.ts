/**
 * Language Quality Testing Utilities
 * 
 * Provides utilities for testing STT accuracy, TTS quality,
 * and translation quality for all supported Indian languages.
 */

import { Locale, locales, localeNames } from './config';
import { SAMPLE_TEXT, validateTextScript, LOCALE_TO_SCRIPT } from './language-utils';

// STT Language codes mapping (locale -> STT API code)
export const STT_LANGUAGE_CODES: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  or: 'or-IN',
};

// TTS Language codes mapping (locale -> TTS API code)
export const TTS_LANGUAGE_CODES: Record<Locale, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
  or: 'or-IN',
};

export interface LanguageQualityResult {
  locale: Locale;
  languageName: string;
  nativeName: string;
  sttCode: string;
  ttsCode: string;
  scriptValidation: {
    isValid: boolean;
    confidence: number;
    expectedScript: string;
  };
  sampleText: string;
}

export interface STTTestResult {
  locale: Locale;
  inputText: string;
  transcribedText: string;
  accuracy: number;
  wordErrorRate: number;
  characterErrorRate: number;
  duration: number;
}

export interface TTSTestResult {
  locale: Locale;
  inputText: string;
  audioGenerated: boolean;
  audioDuration: number;
  audioSize: number;
  generationTime: number;
  error?: string;
}

export interface TranslationTestResult {
  sourceLocale: Locale;
  targetLocale: Locale;
  sourceText: string;
  translatedText: string;
  scriptValidation: {
    isValid: boolean;
    confidence: number;
  };
  qualityScore: number;
}

/**
 * Get language quality information for all supported locales
 */
export function getLanguageQualityInfo(): LanguageQualityResult[] {
  return locales.map((locale) => {
    const scriptValidation = validateTextScript(SAMPLE_TEXT[locale], locale);
    
    return {
      locale,
      languageName: localeNames[locale].name,
      nativeName: localeNames[locale].nativeName,
      sttCode: STT_LANGUAGE_CODES[locale],
      ttsCode: TTS_LANGUAGE_CODES[locale],
      scriptValidation: {
        isValid: scriptValidation.isValid,
        confidence: scriptValidation.confidence,
        expectedScript: scriptValidation.expectedScript,
      },
      sampleText: SAMPLE_TEXT[locale],
    };
  });
}

/**
 * Calculate Word Error Rate (WER) between reference and hypothesis
 */
export function calculateWER(reference: string, hypothesis: string): number {
  const refWords = reference.toLowerCase().split(/\s+/).filter(Boolean);
  const hypWords = hypothesis.toLowerCase().split(/\s+/).filter(Boolean);
  
  if (refWords.length === 0) return hypWords.length > 0 ? 1 : 0;
  
  // Levenshtein distance at word level
  const m = refWords.length;
  const n = hypWords.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // deletion
          dp[i][j - 1],     // insertion
          dp[i - 1][j - 1]  // substitution
        );
      }
    }
  }
  
  return dp[m][n] / m;
}

/**
 * Calculate Character Error Rate (CER) between reference and hypothesis
 */
export function calculateCER(reference: string, hypothesis: string): number {
  const ref = reference.replace(/\s+/g, '');
  const hyp = hypothesis.replace(/\s+/g, '');
  
  if (ref.length === 0) return hyp.length > 0 ? 1 : 0;
  
  // Levenshtein distance at character level
  const m = ref.length;
  const n = hyp.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],
          dp[i][j - 1],
          dp[i - 1][j - 1]
        );
      }
    }
  }
  
  return dp[m][n] / m;
}

/**
 * Calculate accuracy from WER (1 - WER, clamped to 0-1)
 */
export function werToAccuracy(wer: number): number {
  return Math.max(0, Math.min(1, 1 - wer));
}

/**
 * Validate translation quality by checking script and basic metrics
 */
export function validateTranslation(
  sourceText: string,
  translatedText: string,
  targetLocale: Locale
): { isValid: boolean; confidence: number; issues: string[] } {
  const issues: string[] = [];
  
  // Check if translation is empty
  if (!translatedText || translatedText.trim().length === 0) {
    issues.push('Translation is empty');
    return { isValid: false, confidence: 0, issues };
  }
  
  // Check if translation is same as source (might indicate failure)
  if (sourceText.trim() === translatedText.trim()) {
    issues.push('Translation is identical to source');
  }
  
  // Validate script
  const scriptValidation = validateTextScript(translatedText, targetLocale);
  if (!scriptValidation.isValid) {
    issues.push(`Script validation failed: expected ${scriptValidation.expectedScript}, detected ${scriptValidation.detectedScript}`);
  }
  
  // Check length ratio (translations shouldn't be drastically different in length)
  const lengthRatio = translatedText.length / sourceText.length;
  if (lengthRatio < 0.3 || lengthRatio > 3) {
    issues.push(`Unusual length ratio: ${lengthRatio.toFixed(2)}`);
  }
  
  // Calculate confidence based on issues
  let confidence = 1.0;
  confidence -= issues.length * 0.2;
  confidence = Math.max(0, Math.min(1, confidence));
  
  // Boost confidence if script validation passed with high confidence
  if (scriptValidation.isValid && scriptValidation.confidence > 0.5) {
    confidence = Math.min(1, confidence + 0.1);
  }
  
  return {
    isValid: issues.length === 0 || (issues.length === 1 && scriptValidation.isValid),
    confidence,
    issues,
  };
}

/**
 * Get test phrases for a specific language
 * These are common phrases useful for testing STT/TTS
 */
export function getTestPhrases(locale: Locale): string[] {
  const commonPhrases: Record<Locale, string[]> = {
    en: [
      'Hello, how are you?',
      'The weather is nice today.',
      'I would like to order food.',
      'Thank you very much.',
      'What time is it?',
    ],
    hi: [
      'नमस्ते, आप कैसे हैं?',
      'आज मौसम अच्छा है।',
      'मुझे खाना ऑर्डर करना है।',
      'बहुत बहुत धन्यवाद।',
      'क्या समय हुआ है?',
    ],
    bn: [
      'নমস্কার, আপনি কেমন আছেন?',
      'আজ আবহাওয়া ভালো।',
      'আমি খাবার অর্ডার করতে চাই।',
      'অনেক ধন্যবাদ।',
      'কটা বাজে?',
    ],
    ta: [
      'வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?',
      'இன்று வானிலை நன்றாக உள்ளது.',
      'நான் உணவு ஆர்டர் செய்ய விரும்புகிறேன்.',
      'மிக்க நன்றி.',
      'என்ன நேரம்?',
    ],
    te: [
      'నమస్కారం, మీరు ఎలా ఉన్నారు?',
      'ఈ రోజు వాతావరణం బాగుంది.',
      'నేను ఆహారం ఆర్డర్ చేయాలనుకుంటున్నాను.',
      'చాలా ధన్యవాదాలు.',
      'ఎంత సమయం అయింది?',
    ],
    mr: [
      'नमस्कार, तुम्ही कसे आहात?',
      'आज हवामान छान आहे.',
      'मला जेवण ऑर्डर करायचे आहे.',
      'खूप खूप धन्यवाद.',
      'किती वाजले?',
    ],
    gu: [
      'નમસ્તે, તમે કેમ છો?',
      'આજે હવામાન સારું છે.',
      'મારે ખોરાક ઓર્ડર કરવો છે.',
      'ખૂબ ખૂબ આભાર.',
      'કેટલા વાગ્યા?',
    ],
    kn: [
      'ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಿ?',
      'ಇಂದು ಹವಾಮಾನ ಚೆನ್ನಾಗಿದೆ.',
      'ನಾನು ಆಹಾರ ಆರ್ಡರ್ ಮಾಡಲು ಬಯಸುತ್ತೇನೆ.',
      'ತುಂಬಾ ಧನ್ಯವಾದಗಳು.',
      'ಎಷ್ಟು ಗಂಟೆ ಆಯಿತು?',
    ],
    ml: [
      'നമസ്കാരം, സുഖമാണോ?',
      'ഇന്ന് കാലാവസ്ഥ നല്ലതാണ്.',
      'എനിക്ക് ഭക്ഷണം ഓർഡർ ചെയ്യണം.',
      'വളരെ നന്ദി.',
      'എത്ര മണി ആയി?',
    ],
    pa: [
      'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
      'ਅੱਜ ਮੌਸਮ ਵਧੀਆ ਹੈ।',
      'ਮੈਂ ਖਾਣਾ ਆਰਡਰ ਕਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ।',
      'ਬਹੁਤ ਬਹੁਤ ਧੰਨਵਾਦ।',
      'ਕਿੰਨੇ ਵਜੇ ਹਨ?',
    ],
    or: [
      'ନମସ୍କାର, ଆପଣ କେମିତି ଅଛନ୍ତି?',
      'ଆଜି ପାଣିପାଗ ଭଲ ଅଛି।',
      'ମୁଁ ଖାଦ୍ୟ ଅର୍ଡର କରିବାକୁ ଚାହେଁ।',
      'ବହୁତ ଧନ୍ୟବାଦ।',
      'କେତେ ବେଳେ ହେଲା?',
    ],
  };
  
  return commonPhrases[locale] || commonPhrases.en;
}

/**
 * Language support status for each feature
 */
export interface LanguageSupportStatus {
  locale: Locale;
  ui: boolean;
  stt: boolean;
  tts: boolean;
  translation: boolean;
  fonts: boolean;
}

/**
 * Get support status for all languages
 */
export function getLanguageSupportStatus(): LanguageSupportStatus[] {
  return locales.map((locale) => ({
    locale,
    ui: true, // All locales have UI translations
    stt: true, // All locales supported by Google Cloud STT
    tts: true, // All locales supported by Sarvam TTS
    translation: true, // All locales supported by Gemini translation
    fonts: true, // All locales have Noto Sans fonts
  }));
}
