"use client";

/**
 * Highlighted Story Content Component
 * 
 * Renders story content with text highlighting during audio playback.
 * Supports:
 * - Sentence-level highlighting
 * - Smooth scrolling to current position
 * - Visual feedback for current narration position
 * 
 * Requirements: 8.6
 */

import React, { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useAudioTextHighlight, type TextSegment } from "@/hooks/use-audio-text-highlight";

interface HighlightedStoryContentProps {
  /** Story content text (plain text, not markdown) */
  content: string;
  /** Current audio playback time in seconds */
  currentTime: number;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Whether highlighting is enabled */
  highlightEnabled?: boolean;
  /** Words per minute for timing estimation */
  wordsPerMinute?: number;
  /** Scroll offset from top */
  scrollOffset?: number;
  /** Additional class name */
  className?: string;
  /** Callback when user clicks on a segment */
  onSegmentClick?: (segmentIndex: number, estimatedTime: number) => void;
}

/**
 * Individual highlighted segment component
 */
interface HighlightedSegmentProps {
  segment: TextSegment;
  isHighlighted: boolean;
  progress: number;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onClick?: () => void;
}

function HighlightedSegment({
  segment,
  isHighlighted,
  progress,
  registerRef,
  onClick,
}: HighlightedSegmentProps) {
  const ref = useCallback(
    (el: HTMLElement | null) => {
      registerRef(segment.id, el);
    },
    [segment.id, registerRef]
  );

  return (
    <span
      ref={ref}
      data-segment-id={segment.id}
      onClick={onClick}
      className={cn(
        "transition-all duration-300 ease-in-out cursor-pointer rounded px-0.5 -mx-0.5",
        isHighlighted
          ? "bg-primary/20 text-foreground"
          : "hover:bg-muted/50"
      )}
      style={{
        // Add subtle gradient for progress within segment
        background: isHighlighted
          ? `linear-gradient(90deg, hsl(var(--primary) / 0.25) ${progress}%, hsl(var(--primary) / 0.1) ${progress}%)`
          : undefined,
      }}
    >
      {segment.text}{" "}
    </span>
  );
}

/**
 * Main highlighted story content component
 */
export function HighlightedStoryContent({
  content,
  currentTime,
  isPlaying,
  highlightEnabled = true,
  wordsPerMinute = 150,
  scrollOffset = 120,
  className,
  onSegmentClick,
}: HighlightedStoryContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Use the text highlight hook
  const {
    segments,
    highlightState,
    registerSegmentRef,
    updateHighlight,
    isSegmentHighlighted,
  } = useAudioTextHighlight({
    text: content,
    enabled: highlightEnabled,
    wordsPerMinute,
    scrollOffset,
    containerRef,
  });

  // Update highlight when time or playing state changes
  useEffect(() => {
    updateHighlight(currentTime, isPlaying);
  }, [currentTime, isPlaying, updateHighlight]);

  // Handle segment click
  const handleSegmentClick = useCallback(
    (segmentIndex: number) => {
      const segment = segments[segmentIndex];
      if (segment && onSegmentClick) {
        onSegmentClick(segmentIndex, segment.estimatedStartTime);
      }
    },
    [segments, onSegmentClick]
  );

  // If no content or highlighting disabled, render plain text
  if (!content || !highlightEnabled || segments.length === 0) {
    return (
      <div className={cn("prose prose-lg dark:prose-invert max-w-none", className)}>
        <p className="text-base md:text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {content}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("prose prose-lg dark:prose-invert max-w-none", className)}
    >
      <p className="text-base md:text-lg leading-relaxed text-foreground/90">
        {segments.map((segment, index) => (
          <HighlightedSegment
            key={segment.id}
            segment={segment}
            isHighlighted={isSegmentHighlighted(segment.id)}
            progress={
              highlightState.currentSegmentId === segment.id
                ? highlightState.progress
                : 0
            }
            registerRef={registerSegmentRef}
            onClick={() => handleSegmentClick(index)}
          />
        ))}
      </p>
    </div>
  );
}

export default HighlightedStoryContent;
