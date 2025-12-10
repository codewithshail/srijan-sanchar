/**
 * Language-specific utilities for proper font support, RTL handling,
 * and language quality validation
 */

import { Locale, locales } from './config';

// Font families for each language script
export const LANGUAGE_FONTS: Record<Locale, { primary: string; fallback: string }> = {
  en: { primary: 'var(--font-geist-sans)', fallback: 'system-ui, sans-serif' },
  hi: { primary: '"Noto Sans Devanagari"', fallback: '"Mangal", "Devanagari MT", sans-serif' },
  bn: { primary: '"Noto Sans Bengali"', fallback: '"Vrinda", "Bangla MN", sans-serif' },
  ta: { primary: '"Noto Sans Tamil"', fallback: '"Latha", "Tamil MN", sans-serif' },
  te: { primary: '"Noto Sans Telugu"', fallback: '"Gautami", "Telugu MN", sans-serif' },
  mr: { primary: '"Noto Sans Devanagari"', fallback: '"Mangal", "Devanagari MT", sans-serif' },
  gu: { primary: '"Noto Sans Gujarati"', fallback: '"Shruti", "Gujarati MT", sans-serif' },
  kn: { primary: '"Noto Sans Kannada"', fallback: '"Tunga", "Kannada MN", sans-serif' },
  ml: { primary: '"Noto Sans Malayalam"', fallback: '"Kartika", "Malayalam MN", sans-serif' },
  pa: { primary: '"Noto Sans Gurmukhi"', fallback: '"Raavi", "Gurmukhi MN", sans-serif' },
  or: { primary: '"Noto Sans Oriya"', fallback: '"Kalinga", "Oriya MN", sans-serif' },
};

// Script direction for each language (all Indian languages are LTR)
export const LANGUAGE_DIRECTION: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  hi: 'ltr',
  bn: 'ltr',
  ta: 'ltr',
  te: 'ltr',
  mr: 'ltr',
  gu: 'ltr',
  kn: 'ltr',
  ml: 'ltr',
  pa: 'ltr',
  or: 'ltr',
};

// Unicode ranges for each script (for font subsetting and validation)
export const SCRIPT_UNICODE_RANGES: Record<string, { start: number; end: number; name: string }[]> = {
  devanagari: [
    { start: 0x0900, end: 0x097F, name: 'Devanagari' },
    { start: 0xA8E0, end: 0xA8FF, name: 'Devanagari Extended' },
  ],
  bengali: [
    { start: 0x0980, end: 0x09FF, name: 'Bengali' },
  ],
  tamil: [
    { start: 0x0B80, end: 0x0BFF, name: 'Tamil' },
  ],
  telugu: [
    { start: 0x0C00, end: 0x0C7F, name: 'Telugu' },
  ],
  gujarati: [
    { start: 0x0A80, end: 0x0AFF, name: 'Gujarati' },
  ],
  kannada: [
    { start: 0x0C80, end: 0x0CFF, name: 'Kannada' },
  ],
  malayalam: [
    { start: 0x0D00, end: 0x0D7F, name: 'Malayalam' },
  ],
  gurmukhi: [
    { start: 0x0A00, end: 0x0A7F, name: 'Gurmukhi' },
  ],
  oriya: [
    { start: 0x0B00, end: 0x0B7F, name: 'Oriya' },
  ],
};

// Map locale to script
export const LOCALE_TO_SCRIPT: Record<Locale, string> = {
  en: 'latin',
  hi: 'devanagari',
  bn: 'bengali',
  ta: 'tamil',
  te: 'telugu',
  mr: 'devanagari',
  gu: 'gujarati',
  kn: 'kannada',
  ml: 'malayalam',
  pa: 'gurmukhi',
  or: 'oriya',
};

/**
 * Get the font family CSS value for a locale
 */
export function getFontFamily(locale: Locale): string {
  const fonts = LANGUAGE_FONTS[locale];
  return `${fonts.primary}, ${fonts.fallback}`;
}

/**
 * Get the text direction for a locale
 */
export function getTextDirection(locale: Locale): 'ltr' | 'rtl' {
  return LANGUAGE_DIRECTION[locale];
}

/**
 * Check if a locale uses RTL script
 */
export function isRTL(locale: Locale): boolean {
  return LANGUAGE_DIRECTION[locale] === 'rtl';
}

/**
 * Detect the primary script/language of a text
 */
export function detectScript(text: string): string | null {
  if (!text) return null;
  
  const scriptCounts: Record<string, number> = {};
  
  for (const char of text) {
    const codePoint = char.codePointAt(0);
    if (!codePoint) continue;
    
    for (const [script, ranges] of Object.entries(SCRIPT_UNICODE_RANGES)) {
      for (const range of ranges) {
        if (codePoint >= range.start && codePoint <= range.end) {
          scriptCounts[script] = (scriptCounts[script] || 0) + 1;
          break;
        }
      }
    }
  }
  
  // Find the script with the most characters
  let maxScript: string | null = null;
  let maxCount = 0;
  
  for (const [script, count] of Object.entries(scriptCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxScript = script;
    }
  }
  
  return maxScript;
}

/**
 * Validate that text contains characters from the expected script
 */
export function validateTextScript(text: string, expectedLocale: Locale): {
  isValid: boolean;
  detectedScript: string | null;
  expectedScript: string;
  confidence: number;
} {
  const expectedScript = LOCALE_TO_SCRIPT[expectedLocale];
  const detectedScript = detectScript(text);
  
  // For English, we don't need script validation
  if (expectedLocale === 'en') {
    return {
      isValid: true,
      detectedScript: 'latin',
      expectedScript,
      confidence: 1.0,
    };
  }
  
  // Calculate confidence based on script character ratio
  let scriptCharCount = 0;
  let totalNonSpaceChars = 0;
  
  const ranges = SCRIPT_UNICODE_RANGES[expectedScript] || [];
  
  for (const char of text) {
    if (char.trim() === '') continue;
    totalNonSpaceChars++;
    
    const codePoint = char.codePointAt(0);
    if (!codePoint) continue;
    
    for (const range of ranges) {
      if (codePoint >= range.start && codePoint <= range.end) {
        scriptCharCount++;
        break;
      }
    }
  }
  
  const confidence = totalNonSpaceChars > 0 ? scriptCharCount / totalNonSpaceChars : 0;
  
  return {
    isValid: detectedScript === expectedScript || confidence > 0.3,
    detectedScript,
    expectedScript,
    confidence,
  };
}

/**
 * Get CSS custom properties for a locale
 */
export function getLocaleStyles(locale: Locale): Record<string, string> {
  const fonts = LANGUAGE_FONTS[locale];
  const direction = LANGUAGE_DIRECTION[locale];
  
  return {
    '--locale-font-family': `${fonts.primary}, ${fonts.fallback}`,
    '--locale-direction': direction,
    '--locale-text-align': direction === 'rtl' ? 'right' : 'left',
  };
}

/**
 * Generate Google Fonts URL for all supported languages
 */
export function getGoogleFontsUrl(): string {
  const families = [
    'Noto+Sans+Devanagari:wght@400;500;600;700',
    'Noto+Sans+Bengali:wght@400;500;600;700',
    'Noto+Sans+Tamil:wght@400;500;600;700',
    'Noto+Sans+Telugu:wght@400;500;600;700',
    'Noto+Sans+Gujarati:wght@400;500;600;700',
    'Noto+Sans+Kannada:wght@400;500;600;700',
    'Noto+Sans+Malayalam:wght@400;500;600;700',
    'Noto+Sans+Gurmukhi:wght@400;500;600;700',
    'Noto+Sans+Oriya:wght@400;500;600;700',
  ];
  
  return `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;
}

/**
 * Sample text for each language (for testing font rendering)
 */
export const SAMPLE_TEXT: Record<Locale, string> = {
  en: 'The quick brown fox jumps over the lazy dog.',
  hi: 'सभी मनुष्यों को गौरव और अधिकारों के मामले में जन्मजात स्वतन्त्रता प्राप्त है।',
  bn: 'সমস্ত মানুষ স্বাধীনভাবে সমান মর্যাদা এবং অধিকার নিয়ে জন্মগ্রহণ করে।',
  ta: 'மனிதப் பிறவியினர் சகலரும் சுதந்திரமாகவே பிறக்கின்றனர்.',
  te: 'ప్రతిపత్తిస్వత్వముల విషయమున మానవులెల్లరును జన్మతః స్వతంత్రులును సమానులును.',
  mr: 'सर्व मानवी व्यक्ती जन्मतः स्वतंत्र आहेत व त्यांना समान प्रतिष्ठा व समान अधिकार आहेत.',
  gu: 'પ્રતિષ્ઠા અને અધિકારોની દૃષ્ટિએ સર્વ માનવો જન્મથી સ્વતંત્ર અને સમાન છે.',
  kn: 'ಎಲ್ಲಾ ಮಾನವರೂ ಸ್ವತಂತ್ರರಾಗಿಯೇ ಜನಿಸಿದ್ದಾರೆ, ಹಾಗೂ ಘನತೆ ಮತ್ತು ಹಕ್ಕುಗಳಲ್ಲಿ ಸಮಾನರಾಗಿದ್ದಾರೆ.',
  ml: 'മനുഷ്യരെല്ലാവരും തുല്യാവകാശങ്ങളോടും അന്തസ്സോടും സ്വാതന്ത്ര്യത്തോടുംകൂടി ജനിച്ചവരാണ്.',
  pa: 'ਸਾਰੇ ਮਨੁੱਖ ਆਜ਼ਾਦ ਅਤੇ ਬਰਾਬਰ ਦੇ ਹੱਕਾਂ ਅਤੇ ਇੱਜ਼ਤ ਨਾਲ ਜੰਮੇ ਹਨ।',
  or: 'ସମସ୍ତ ମନୁଷ୍ୟ ଜନ୍ମକାଳରୁ ସ୍ୱାଧୀନ ଏବଂ ମର୍ଯ୍ୟାଦା ଓ ଅଧିକାରରେ ସମାନ।',
};
