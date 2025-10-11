import type { Metadata } from "next";
import {
  HeroSection,
  FeaturesSection,
  HowItWorksSection,
  TestimonialsSection,
  PricingSection,
  FinalCTASection,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "StoryWeave - Transform Your Life Through Storytelling",
  description:
    "Create, publish, and share your life stories with AI assistance. Write therapeutic life narratives or creative stories, generate audio narrations, and order printed books.",
  keywords:
    "storytelling, life stories, AI writing assistant, audio books, print on demand, creative writing, personal growth",
  openGraph: {
    title: "StoryWeave - Transform Your Life Through Storytelling",
    description:
      "Create, publish, and share your life stories with AI assistance.",
    type: "website",
  },
};

export default function Home() {
  return (
    <div className="flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <FinalCTASection />
    </div>
  );
}
