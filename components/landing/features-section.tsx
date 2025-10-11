import { Card, CardContent } from "@/components/ui/card";
import {
  Sparkles,
  Mic,
  Globe,
  Headphones,
  BookOpen,
  BookMarked,
  Printer,
  Share2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: Sparkles,
    title: "AI Writing Assistant",
    description:
      "Get intelligent suggestions, grammar improvements, content expansion, and translations in multiple Indian languages as you write.",
  },
  {
    icon: Mic,
    title: "Voice Input",
    description:
      "Speak your story naturally with high-accuracy speech-to-text supporting all major Indian languages. Perfect for capturing memories on the go.",
  },
  {
    icon: Globe,
    title: "Publish & Share",
    description:
      "Share your stories with the world. Publish online with beautiful formatting, AI-generated images, and easy social media sharing.",
  },
  {
    icon: Headphones,
    title: "Audio Narration",
    description:
      "Convert your stories to natural-sounding audio in multiple languages. Listen anywhere with chapter-based navigation.",
  },
  {
    icon: BookOpen,
    title: "AI-Generated Images",
    description:
      "Enhance your stories with contextual AI-generated images that bring your narrative to life with stunning visuals.",
  },
  {
    icon: BookMarked,
    title: "Create eBooks",
    description:
      "Transform your stories into professionally formatted eBooks with customizable layouts, fonts, and styling options.",
  },
  {
    icon: Printer,
    title: "Print on Demand",
    description:
      "Order beautiful hardcover or paperback books of your stories. Perfect for gifting or keeping as treasured memories.",
  },
  {
    icon: Share2,
    title: "Multi-Language Support",
    description:
      "Write and read in Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, and 5+ other Indian languages.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Everything You Need to Tell Your Story
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features to help you write, publish, and share your stories
            with the world
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="border-2 hover:border-primary/50 transition-colors"
              >
                <CardContent className="pt-6">
                  <div className="rounded-full bg-primary/10 w-12 h-12 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
