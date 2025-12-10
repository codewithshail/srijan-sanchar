/**
 * Image Optimization Tests
 * 
 * Tests for the image optimization module including:
 * - URL generation
 * - Blur placeholder generation
 * - Srcset generation
 * - Lazy loading utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IMAGE_SIZE_PRESETS,
  generateBlurDataUrl,
  calculateAspectRatio,
  getDimensionsForAspectRatio,
  getLoadingAttribute,
  getFetchPriority,
  supportsNativeLazyLoading,
  createImageLoadingTracker,
} from '../index';

describe('Image Size Presets', () => {
  it('should have all required size presets', () => {
    expect(IMAGE_SIZE_PRESETS).toHaveProperty('thumbnail');
    expect(IMAGE_SIZE_PRESETS).toHaveProperty('small');
    expect(IMAGE_SIZE_PRESETS).toHaveProperty('medium');
    expect(IMAGE_SIZE_PRESETS).toHaveProperty('large');
    expect(IMAGE_SIZE_PRESETS).toHaveProperty('banner');
    expect(IMAGE_SIZE_PRESETS).toHaveProperty('print');
  });

  it('should have correct dimensions for thumbnail', () => {
    expect(IMAGE_SIZE_PRESETS.thumbnail.width).toBe(150);
    expect(IMAGE_SIZE_PRESETS.thumbnail.height).toBe(150);
    expect(IMAGE_SIZE_PRESETS.thumbnail.quality).toBe(70);
  });

  it('should have correct dimensions for print', () => {
    expect(IMAGE_SIZE_PRESETS.print.width).toBe(3000);
    expect(IMAGE_SIZE_PRESETS.print.height).toBe(2000);
    expect(IMAGE_SIZE_PRESETS.print.quality).toBe(100);
  });
});

describe('Blur Data URL Generation', () => {
  it('should generate a valid data URL', () => {
    const blurUrl = generateBlurDataUrl(10, 10, '#e2e8f0');
    expect(blurUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('should use default values when not provided', () => {
    const blurUrl = generateBlurDataUrl();
    expect(blurUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('should include the specified color', () => {
    const blurUrl = generateBlurDataUrl(10, 10, '#ff0000');
    const decoded = Buffer.from(blurUrl.split(',')[1], 'base64').toString();
    expect(decoded).toContain('#ff0000');
  });
});

describe('Aspect Ratio Calculations', () => {
  it('should calculate correct aspect ratio', () => {
    expect(calculateAspectRatio(1920, 1080)).toBeCloseTo(16 / 9, 2);
    expect(calculateAspectRatio(800, 600)).toBeCloseTo(4 / 3, 2);
    expect(calculateAspectRatio(100, 100)).toBe(1);
  });

  it('should get dimensions for aspect ratio', () => {
    const dims = getDimensionsForAspectRatio(1600, 16 / 9);
    expect(dims.width).toBe(1600);
    expect(dims.height).toBe(900);
  });
});

describe('Loading Attributes', () => {
  it('should return eager for high priority', () => {
    expect(getLoadingAttribute('high')).toBe('eager');
  });

  it('should return lazy for low priority', () => {
    expect(getLoadingAttribute('low')).toBe('lazy');
  });

  it('should return lazy for auto priority', () => {
    expect(getLoadingAttribute('auto')).toBe('lazy');
  });

  it('should return correct fetch priority', () => {
    expect(getFetchPriority('high')).toBe('high');
    expect(getFetchPriority('low')).toBe('low');
    expect(getFetchPriority('auto')).toBe('auto');
  });
});

describe('Image Loading Tracker', () => {
  it('should track image loading states', () => {
    const tracker = createImageLoadingTracker();
    
    expect(tracker.getState('test.jpg')).toBe('idle');
    
    tracker.setState('test.jpg', 'loading');
    expect(tracker.isLoading('test.jpg')).toBe(true);
    expect(tracker.isLoaded('test.jpg')).toBe(false);
    
    tracker.setState('test.jpg', 'loaded');
    expect(tracker.isLoading('test.jpg')).toBe(false);
    expect(tracker.isLoaded('test.jpg')).toBe(true);
  });

  it('should clear all states', () => {
    const tracker = createImageLoadingTracker();
    
    tracker.setState('test1.jpg', 'loaded');
    tracker.setState('test2.jpg', 'loading');
    
    tracker.clear();
    
    expect(tracker.getState('test1.jpg')).toBe('idle');
    expect(tracker.getState('test2.jpg')).toBe('idle');
  });
});

describe('Native Lazy Loading Support', () => {
  it('should return false in Node environment', () => {
    // In Node.js test environment, window is undefined
    expect(supportsNativeLazyLoading()).toBe(false);
  });
});
