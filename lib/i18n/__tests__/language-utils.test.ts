/**
 * Tests for language utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getFontFamily,
  getTextDirection,
  isRTL,
  detectScript,
  validateTextScript,
  SAMPLE_TEXT,
  LANGUAGE_FONTS,
  LOCALE_TO_SCRIPT,
} from '../language-utils';
import type { Locale } from '../config';

describe('Language Utils', () => {
  describe('getFontFamily', () => {
    it('returns correct font family for English', () => {
      const fontFamily = getFontFamily('en');
      expect(fontFamily).toContain('var(--font-geist-sans)');
    });

    it('returns Noto Sans Devanagari for Hindi', () => {
      const fontFamily = getFontFamily('hi');
      expect(fontFamily).toContain('Noto Sans Devanagari');
    });

    it('returns Noto Sans Bengali for Bengali', () => {
      const fontFamily = getFontFamily('bn');
      expect(fontFamily).toContain('Noto Sans Bengali');
    });

    it('returns Noto Sans Tamil for Tamil', () => {
      const fontFamily = getFontFamily('ta');
      expect(fontFamily).toContain('Noto Sans Tamil');
    });
  });

  describe('getTextDirection', () => {
    it('returns ltr for all Indian languages', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        expect(getTextDirection(locale)).toBe('ltr');
      });
    });
  });

  describe('isRTL', () => {
    it('returns false for all supported languages', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        expect(isRTL(locale)).toBe(false);
      });
    });
  });

  describe('detectScript', () => {
    it('detects Devanagari script in Hindi text', () => {
      const script = detectScript('नमस्ते दुनिया');
      expect(script).toBe('devanagari');
    });

    it('detects Bengali script', () => {
      const script = detectScript('নমস্কার বিশ্ব');
      expect(script).toBe('bengali');
    });

    it('detects Tamil script', () => {
      const script = detectScript('வணக்கம் உலகம்');
      expect(script).toBe('tamil');
    });

    it('detects Telugu script', () => {
      const script = detectScript('నమస్కారం ప్రపంచం');
      expect(script).toBe('telugu');
    });

    it('detects Gujarati script', () => {
      const script = detectScript('નમસ્તે વિશ્વ');
      expect(script).toBe('gujarati');
    });

    it('detects Kannada script', () => {
      const script = detectScript('ನಮಸ್ಕಾರ ಪ್ರಪಂಚ');
      expect(script).toBe('kannada');
    });

    it('detects Malayalam script', () => {
      const script = detectScript('നമസ്കാരം ലോകം');
      expect(script).toBe('malayalam');
    });

    it('detects Gurmukhi script for Punjabi', () => {
      const script = detectScript('ਸਤ ਸ੍ਰੀ ਅਕਾਲ');
      expect(script).toBe('gurmukhi');
    });

    it('detects Oriya script', () => {
      const script = detectScript('ନମସ୍କାର ବିଶ୍ୱ');
      expect(script).toBe('oriya');
    });

    it('returns null for empty text', () => {
      expect(detectScript('')).toBeNull();
    });

    it('returns null for English text (no Indic script)', () => {
      expect(detectScript('Hello World')).toBeNull();
    });
  });

  describe('validateTextScript', () => {
    it('validates Hindi text correctly', () => {
      const result = validateTextScript('नमस्ते दुनिया', 'hi');
      expect(result.isValid).toBe(true);
      expect(result.expectedScript).toBe('devanagari');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('validates Bengali text correctly', () => {
      const result = validateTextScript('নমস্কার বিশ্ব', 'bn');
      expect(result.isValid).toBe(true);
      expect(result.expectedScript).toBe('bengali');
    });

    it('validates English text correctly', () => {
      const result = validateTextScript('Hello World', 'en');
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('detects mismatched script', () => {
      // Hindi text validated against Bengali locale
      const result = validateTextScript('नमस्ते दुनिया', 'bn');
      expect(result.detectedScript).toBe('devanagari');
      expect(result.expectedScript).toBe('bengali');
    });
  });

  describe('SAMPLE_TEXT', () => {
    it('has sample text for all supported locales', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        expect(SAMPLE_TEXT[locale]).toBeDefined();
        expect(SAMPLE_TEXT[locale].length).toBeGreaterThan(10);
      });
    });
  });

  describe('LANGUAGE_FONTS', () => {
    it('has font configuration for all locales', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        expect(LANGUAGE_FONTS[locale]).toBeDefined();
        expect(LANGUAGE_FONTS[locale].primary).toBeDefined();
        expect(LANGUAGE_FONTS[locale].fallback).toBeDefined();
      });
    });
  });

  describe('LOCALE_TO_SCRIPT', () => {
    it('maps all locales to scripts', () => {
      const locales: Locale[] = ['en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'pa', 'or'];
      locales.forEach((locale) => {
        expect(LOCALE_TO_SCRIPT[locale]).toBeDefined();
      });
    });

    it('maps Hindi and Marathi to Devanagari', () => {
      expect(LOCALE_TO_SCRIPT['hi']).toBe('devanagari');
      expect(LOCALE_TO_SCRIPT['mr']).toBe('devanagari');
    });
  });
});
