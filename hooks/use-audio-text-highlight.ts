"use client";

/**
 * Audio Text Highlighting Hook
 * 
 * Provides functionality to highlight text during audio playback:
 * - Syncs audio position with text position
 * - Calculates which text segment should be highlighted
 * - Provides smooth scrolling to current position
 * 
 * Requirements: 8.6
 */

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Text segment with position information
 */
export interface TextSegment {
  id: string;
  text: string;
  startPosition: number;
  endPosition: number;
  estimatedStartTime: number;
  estimatedEndTime: number;
}

/**
 * Highlight state
 */
export interface HighlightState {
  currentSegmentId: string | null;
  currentSegmentIndex: number;
  progress: number;
  isActive: boolean;
}

/**
 * Hook options
 */
interface UseAudioTextHighlightOptions {
  /** Full text content to highlight */
  text: string;
  /** Whether highlighting is enabled */
  enabled?: boolean;
  /** Average words per minute for timing estimation */
  wordsPerMinute?: number;
  /** Scroll behavior */
  scrollBehavior?: ScrollBehavior;
  /** Scroll offset from top (in pixels) */
  scrollOffset?: number;
  /** Container element ref for scrolling */
  containerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Split text into segments for highlighting
 * Splits on sentence boundaries for natural highlighting
 */
function splitTextIntoSegments(text: string, wordsPerMinute: number): TextSegment[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Split by sentences (period, exclamation, question mark followed by space or end)
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  const sentences = text.match(sentenceRegex) || [text];
  
  const segments: TextSegment[] = [];
  let currentPosition = 0;
  let currentTime = 0;
  
  // Calculate seconds per word
  const secondsPerWord = 60 / wordsPerMinute;
  
  sentences.forEach((sentence, index) => {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) return;
    
    // Find actual position in original text
    const startPosition = text.indexOf(trimmedSentence, currentPosition);
    const endPosition = startPosition + trimmedSentence.length;
    
    // Estimate duration based on word count
    const wordCount = trimmedSentence.split(/\s+/).filter(w => w.length > 0).length;
    const estimatedDuration = wordCount * secondsPerWord;
    
    segments.push({
      id: `segment-${index}`,
      text: trimmedSentence,
      startPosition,
      endPosition,
      estimatedStartTime: currentTime,
      estimatedEndTime: currentTime + estimatedDuration,
    });
    
    currentPosition = endPosition;
    currentTime += estimatedDuration;
  });
  
  return segments;
}

/**
 * Find segment at given time
 */
function findSegmentAtTime(segments: TextSegment[], time: number): number {
  if (segments.length === 0) return -1;
  
  for (let i = 0; i < segments.length; i++) {
    if (time >= segments[i].estimatedStartTime && time < segments[i].estimatedEndTime) {
      return i;
    }
  }
  
  // If past all segments, return last one
  if (time >= segments[segments.length - 1].estimatedEndTime) {
    return segments.length - 1;
  }
  
  return 0;
}

/**
 * Hook for managing audio text highlighting
 */
export function useAudioTextHighlight({
  text,
  enabled = true,
  wordsPerMinute = 150, // Average speaking rate
  scrollBehavior = "smooth",
  scrollOffset = 100,
  containerRef,
}: UseAudioTextHighlightOptions) {
  // State
  const [segments, setSegments] = useState<TextSegment[]>([]);
  const [highlightState, setHighlightState] = useState<HighlightState>({
    currentSegmentId: null,
    currentSegmentIndex: -1,
    progress: 0,
    isActive: false,
  });
  
  // Refs
  const segmentRefs = useRef<Map<string, HTMLElement>>(new Map());
  const lastScrollTime = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  
  // Parse text into segments when text changes
  useEffect(() => {
    if (!text || !enabled) {
      setSegments([]);
      return;
    }
    
    const newSegments = splitTextIntoSegments(text, wordsPerMinute);
    setSegments(newSegments);
  }, [text, enabled, wordsPerMinute]);
  
  // Get total estimated duration
  const totalDuration = segments.length > 0 
    ? segments[segments.length - 1].estimatedEndTime 
    : 0;
  
  // Register a segment element ref
  const registerSegmentRef = useCallback((segmentId: string, element: HTMLElement | null) => {
    if (element) {
      segmentRefs.current.set(segmentId, element);
    } else {
      segmentRefs.current.delete(segmentId);
    }
  }, []);
  
  // Scroll to segment with smooth animation
  const scrollToSegment = useCallback((segmentId: string) => {
    const element = segmentRefs.current.get(segmentId);
    if (!element) return;
    
    // Throttle scrolling to avoid jank
    const now = Date.now();
    if (now - lastScrollTime.current < 500) return;
    lastScrollTime.current = now;
    
    const container = containerRef?.current || window;
    const elementRect = element.getBoundingClientRect();
    
    if (container === window) {
      const targetY = window.scrollY + elementRect.top - scrollOffset;
      window.scrollTo({
        top: targetY,
        behavior: scrollBehavior,
      });
    } else {
      const targetY = element.offsetTop - scrollOffset;
      (container as HTMLElement).scrollTo({
        top: targetY,
        behavior: scrollBehavior,
      });
    }
  }, [containerRef, scrollBehavior, scrollOffset]);
  
  // Update highlight based on current time
  const updateHighlight = useCallback((currentTime: number, isPlaying: boolean) => {
    if (!enabled || segments.length === 0) {
      setHighlightState({
        currentSegmentId: null,
        currentSegmentIndex: -1,
        progress: 0,
        isActive: false,
      });
      return;
    }
    
    const segmentIndex = findSegmentAtTime(segments, currentTime);
    const segment = segments[segmentIndex];
    
    if (!segment) {
      setHighlightState(prev => ({
        ...prev,
        isActive: isPlaying,
      }));
      return;
    }
    
    // Calculate progress within current segment
    const segmentDuration = segment.estimatedEndTime - segment.estimatedStartTime;
    const segmentProgress = segmentDuration > 0
      ? ((currentTime - segment.estimatedStartTime) / segmentDuration) * 100
      : 0;
    
    setHighlightState(prev => {
      const newState = {
        currentSegmentId: segment.id,
        currentSegmentIndex: segmentIndex,
        progress: Math.min(100, Math.max(0, segmentProgress)),
        isActive: isPlaying,
      };
      
      // Scroll to new segment if changed and playing
      if (isPlaying && prev.currentSegmentId !== segment.id) {
        // Use requestAnimationFrame for smooth scrolling
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          scrollToSegment(segment.id);
        });
      }
      
      return newState;
    });
  }, [enabled, segments, scrollToSegment]);
  
  // Start highlighting
  const startHighlighting = useCallback(() => {
    setHighlightState(prev => ({
      ...prev,
      isActive: true,
    }));
  }, []);
  
  // Stop highlighting
  const stopHighlighting = useCallback(() => {
    setHighlightState(prev => ({
      ...prev,
      isActive: false,
    }));
  }, []);
  
  // Reset highlighting
  const resetHighlighting = useCallback(() => {
    setHighlightState({
      currentSegmentId: null,
      currentSegmentIndex: -1,
      progress: 0,
      isActive: false,
    });
  }, []);
  
  // Jump to specific segment
  const jumpToSegment = useCallback((segmentIndex: number): number => {
    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      return 0;
    }
    
    const segment = segments[segmentIndex];
    scrollToSegment(segment.id);
    
    return segment.estimatedStartTime;
  }, [segments, scrollToSegment]);
  
  // Get segment by index
  const getSegment = useCallback((index: number): TextSegment | null => {
    return segments[index] || null;
  }, [segments]);
  
  // Check if a segment is currently highlighted
  const isSegmentHighlighted = useCallback((segmentId: string): boolean => {
    return highlightState.isActive && highlightState.currentSegmentId === segmentId;
  }, [highlightState]);
  
  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  return {
    // Data
    segments,
    totalSegments: segments.length,
    totalDuration,
    highlightState,
    
    // Refs
    registerSegmentRef,
    
    // Actions
    updateHighlight,
    startHighlighting,
    stopHighlighting,
    resetHighlighting,
    jumpToSegment,
    
    // Helpers
    getSegment,
    isSegmentHighlighted,
  };
}

export default useAudioTextHighlight;
