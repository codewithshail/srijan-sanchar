/**
 * Client-safe AI constants
 * These can be safely imported in client components
 */

// Supported languages for Google Cloud Speech-to-Text
export const SUPPORTED_STT_LANGUAGES = [
  { code: "en-IN", name: "English (India)", nativeName: "English" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिंदी" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "or-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
];

export type STTLanguage = (typeof SUPPORTED_STT_LANGUAGES)[number];

// Supported languages for Sarvam AI Bulbul TTS
export const SUPPORTED_TTS_LANGUAGES = [
  { code: "en-IN", name: "English", nativeName: "English" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिंदी" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "or-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
];

export type TTSLanguage = (typeof SUPPORTED_TTS_LANGUAGES)[number];

// Available speakers for Sarvam AI Bulbul v2
export const AVAILABLE_SPEAKERS = [
  { id: "anushka", name: "Anushka", gender: "female" },
  { id: "meera", name: "Meera", gender: "female" },
  { id: "arjun", name: "Arjun", gender: "male" },
  { id: "kavya", name: "Kavya", gender: "female" },
];

export type Speaker = (typeof AVAILABLE_SPEAKERS)[number];
