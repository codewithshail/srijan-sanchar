/**
 * Tests for language quality utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getLanguageQualityInfo,
  getLanguageSupportStatus,
  getTestPhrases,
  validateTranslation,
  calculateWER,
  calculateCER,
  werToAccuracy,
  STT_LANGUAGE_CODES,
  TTS_LANGUAGE_CODES,
} from '../language-quality';
import type { Locale } from '../config';

describe('Language Quality Utils', () => {
  describe('getLanguageQualityInfo', () => {
    it('returns info for all supported languages', () => {
      const info = getLanguageQualityInfo();
      expect(info.length).toBe(11); // 11 supported languages
    });

    it('includes required fields for each language', () => {
      const info = getLanguageQualityInfo();
      info.forEach((lang) => {
        expect(lang.locale).toBeDefined();
        expect(lang.languageName).toBeDefined();
        expect(lang.nativeName).toBeDefined();
        expect(lang.sttCode).toBeDefined();
        expect(lang.ttsCode).toBeDefined();
        expect(lang.sampleText).toBeDefined();
        expect(lang.scriptValidation).toBeDefined();
      });
    });
  });

  describe('getLanguageSupportStatus', () => {
    it('returns status for all languages', () => {
      const status = getLanguageSupportStatus();
      expect(status.length).toBe(11);
    });

    it('shows all features as supported', () => {
      const status = getLanguageSupportStatus();
      status.forEach((lang) => {
        expect(lang.ui).toBe(true);
        expect(lang.stt).toBe(true);
        expect(lang.tts).toBe(true);
        expect(lang.translation).toBe(true);
        expect(lang.fonts).toBe(true);
      });
    });
  });

  describe('getTestPhrases', () => {
    it('returns test phrases for English', () => {
      const phrases = getTestPhrases('en');
      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases[0]).toContain('Hello');
    });

    it('returns test phrases for Hindi', () => {
      const phrases = getTestPhrases('hi');
      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases[0]).toContain('नमस्ते');
    });

    it('returns test phrases for all supported languages', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        const phrases = getTestPhrases(locale);
        expect(phrases.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateTranslation', () => {
    it('validates correct Hindi translation', () => {
      const result = validateTranslation(
        'Hello, how are you?',
        'नमस्ते, आप कैसे हैं?',
        'hi'
      );
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('detects empty translation', () => {
      const result = validateTranslation('Hello', '', 'hi');
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Translation is empty');
    });

    it('detects identical translation (potential failure)', () => {
      const result = validateTranslation('Hello', 'Hello', 'hi');
      expect(result.issues).toContain('Translation is identical to source');
    });

    it('detects unusual length ratio', () => {
      const result = validateTranslation(
        'This is a very long sentence with many words.',
        'छोटा',
        'hi'
      );
      expect(result.issues.some(i => i.includes('length ratio'))).toBe(true);
    });
  });

  describe('calculateWER', () => {
    it('returns 0 for identical strings', () => {
      expect(calculateWER('hello world', 'hello world')).toBe(0);
    });

    it('returns 1 for completely different strings', () => {
      expect(calculateWER('hello', 'goodbye')).toBe(1);
    });

    it('calculates correct WER for partial match', () => {
      // "hello world" vs "hello there" - 1 substitution out of 2 words = 0.5
      expect(calculateWER('hello world', 'hello there')).toBe(0.5);
    });

    it('handles empty reference', () => {
      expect(calculateWER('', 'hello')).toBe(1);
    });

    it('handles empty hypothesis', () => {
      expect(calculateWER('hello', '')).toBe(1);
    });

    it('handles both empty', () => {
      expect(calculateWER('', '')).toBe(0);
    });
  });

  describe('calculateCER', () => {
    it('returns 0 for identical strings', () => {
      expect(calculateCER('hello', 'hello')).toBe(0);
    });

    it('calculates correct CER for single character difference', () => {
      // "hello" vs "hallo" - 1 substitution out of 5 chars = 0.2
      expect(calculateCER('hello', 'hallo')).toBe(0.2);
    });

    it('handles empty strings', () => {
      expect(calculateCER('', '')).toBe(0);
      expect(calculateCER('hello', '')).toBe(1);
      expect(calculateCER('', 'hello')).toBe(1);
    });
  });

  describe('werToAccuracy', () => {
    it('converts WER 0 to accuracy 1', () => {
      expect(werToAccuracy(0)).toBe(1);
    });

    it('converts WER 1 to accuracy 0', () => {
      expect(werToAccuracy(1)).toBe(0);
    });

    it('converts WER 0.5 to accuracy 0.5', () => {
      expect(werToAccuracy(0.5)).toBe(0.5);
    });

    it('clamps values above 1', () => {
      expect(werToAccuracy(1.5)).toBe(0);
    });

    it('clamps values below 0', () => {
      expect(werToAccuracy(-0.5)).toBe(1);
    });
  });

  describe('Language Code Mappings', () => {
    it('has STT codes for all locales', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        expect(STT_LANGUAGE_CODES[locale]).toBeDefined();
        expect(STT_LANGUAGE_CODES[locale]).toMatch(/-IN$/);
      });
    });

    it('has TTS codes for all locales', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        expect(TTS_LANGUAGE_CODES[locale]).toBeDefined();
        expect(TTS_LANGUAGE_CODES[locale]).toMatch(/-IN$/);
      });
    });
  });
});
