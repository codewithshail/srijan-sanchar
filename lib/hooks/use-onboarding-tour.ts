"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";

export type TourId = "dashboard" | "blog-editor" | "life-story";

interface UseOnboardingTourOptions {
  tourId: TourId;
  steps: DriveStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  delay?: number; // Delay before starting tour (ms)
}

const TOUR_STORAGE_PREFIX = "tour-seen-";

/**
 * Hook to manage Driver.js onboarding tours with localStorage persistence.
 * Tours are shown only once per user.
 */
export function useOnboardingTour({
  tourId,
  steps,
  onComplete,
  onSkip,
  delay = 500,
}: UseOnboardingTourOptions) {
  const [hasSeenTour, setHasSeenTour] = useState<boolean | null>(null);
  const [isTourActive, setIsTourActive] = useState(false);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  // Check if user has seen the tour
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(`${TOUR_STORAGE_PREFIX}${tourId}`);
    setHasSeenTour(seen === "true");
  }, [tourId]);

  // Mark tour as seen
  const markTourAsSeen = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`${TOUR_STORAGE_PREFIX}${tourId}`, "true");
    setHasSeenTour(true);
  }, [tourId]);

  // Start the tour
  const startTour = useCallback(() => {
    if (typeof window === "undefined" || steps.length === 0) return;

    // Filter steps based on viewport (skip elements that don't exist)
    const validSteps = steps.filter((step) => {
      if (!step.element) return true; // Allow popover-only steps
      const el = document.querySelector(step.element as string);
      return el !== null;
    });

    if (validSteps.length === 0) return;

    const config: Config = {
      showProgress: true,
      showButtons: ["next", "previous", "close"],
      steps: validSteps,
      animate: true,
      overlayColor: "rgba(0, 0, 0, 0.75)",
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "driver-popover-custom",
      onDestroyStarted: () => {
        markTourAsSeen();
        setIsTourActive(false);
        if (driverRef.current?.hasNextStep()) {
          onSkip?.();
        } else {
          onComplete?.();
        }
        driverRef.current?.destroy();
      },
    };

    driverRef.current = driver(config);
    setIsTourActive(true);
    driverRef.current.drive();
  }, [steps, markTourAsSeen, onComplete, onSkip]);

  // Auto-start tour if not seen
  useEffect(() => {
    if (hasSeenTour === false && !isTourActive) {
      const timer = setTimeout(startTour, delay);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, isTourActive, startTour, delay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  return {
    hasSeenTour,
    isTourActive,
    startTour,
    resetTour: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(`${TOUR_STORAGE_PREFIX}${tourId}`);
        setHasSeenTour(false);
      }
    },
  };
}

// Tour step configurations for each page
export const TOUR_STEPS = {
  dashboard: [
    {
      element: "#dashboard-stats",
      popover: {
        title: "📊 Your Story Stats",
        description: "Track your stories, views, likes, and engagement at a glance.",
        side: "bottom" as const,
      },
    },
    {
      element: "#dashboard-new-story",
      popover: {
        title: "✨ Create New Story",
        description: "Click here to start writing a new story. Choose between Life Story or Blog format.",
        side: "left" as const,
      },
    },
    {
      element: "#dashboard-tabs",
      popover: {
        title: "📁 Navigate Your Content",
        description: "Switch between your stories, liked content, expert sessions, print orders, and analytics.",
        side: "bottom" as const,
      },
    },
    {
      element: "#dashboard-stories",
      popover: {
        title: "📚 Your Stories",
        description: "All your created stories appear here. Edit, publish, or share them anytime.",
        side: "top" as const,
      },
    },
  ] as DriveStep[],

  blogEditor: [
    {
      element: "#editor-title",
      popover: {
        title: "📝 Story Title",
        description: "Start with a compelling title. Use the AI button to improve or generate one!",
        side: "bottom" as const,
      },
    },
    {
      element: "#editor-description",
      popover: {
        title: "📄 Auto-Generated Description",
        description: "Generate a description from your content to help readers discover your story.",
        side: "bottom" as const,
      },
    },
    {
      element: "#editor-ai-toolbar",
      popover: {
        title: "🪄 Srijan Sanchar Tools",
        description: "Improve grammar, expand content, rewrite, or translate your writing with AI assistance.",
        side: "bottom" as const,
      },
    },
    {
      element: "#editor-voice-input",
      popover: {
        title: "🎤 Voice Input",
        description: "Speak to type! Perfect for dictating your stories hands-free.",
        side: "left" as const,
      },
    },
    {
      element: "#editor-content",
      popover: {
        title: "✍️ Rich Content Editor",
        description: "Write your story here with headings, formatting, images, and more. Auto-saves as you type!",
        side: "top" as const,
      },
    },
    {
      element: "#editor-generate",
      popover: {
        title: "🚀 Generate Final Story",
        description: "When ready, generate a polished final version of your story with custom themes.",
        side: "left" as const,
      },
    },
  ] as DriveStep[],

  lifeStory: [
    {
      popover: {
        title: "🌟 Welcome to Life Story",
        description: "Your life story is organized into 7 meaningful stages. Let's explore how it works!",
      },
    },
    {
      element: "#lifestory-stages",
      popover: {
        title: "📖 Life Stages",
        description: "Navigate through 7 stages: Childhood, Teen Years, Young Adult, and more. Complete each at your own pace.",
        side: "right" as const,
      },
    },
    {
      element: "#lifestory-editor",
      popover: {
        title: "✍️ Stage Editor",
        description: "Write about each life stage here. Use voice input, AI tools, and prompts to help you write.",
        side: "left" as const,
      },
    },
    {
      element: "#lifestory-submit",
      popover: {
        title: "🎉 Submit Your Story",
        description: "When all stages are complete, submit to generate your beautiful life story book!",
        side: "top" as const,
      },
    },
  ] as DriveStep[],
};
