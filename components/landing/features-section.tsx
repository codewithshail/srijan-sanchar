"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Mic,
  Globe,
  Headphones,
  BookOpen,
  BookMarked,
  Printer,
  Languages,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  gradient: string;
}

const features: Feature[] = [
  {
    icon: Sparkles,
    titleKey: "aiWriting",
    descriptionKey: "aiWritingDesc",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Mic,
    titleKey: "voiceInput",
    descriptionKey: "voiceInputDesc",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    icon: Globe,
    titleKey: "publishShare",
    descriptionKey: "publishShareDesc",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Headphones,
    titleKey: "audioNarration",
    descriptionKey: "audioNarrationDesc",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    icon: BookOpen,
    titleKey: "aiImages",
    descriptionKey: "aiImagesDesc",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: BookMarked,
    titleKey: "createEbooks",
    descriptionKey: "createEbooksDesc",
    gradient: "from-indigo-500 to-blue-500",
  },
  {
    icon: Printer,
    titleKey: "printOnDemand",
    descriptionKey: "printOnDemandDesc",
    gradient: "from-slate-600 to-slate-800",
  },
  {
    icon: Languages,
    titleKey: "multiLanguage",
    descriptionKey: "multiLanguageDesc",
    gradient: "from-cyan-500 to-blue-500",
  },
];

export function FeaturesSection() {
  const t = useTranslations("landing.features");
  const tLanding = useTranslations("landing");

  return (
    <section className="py-20 sm:py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 sm:mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {tLanding("featuresLabel")}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {tLanding("featuresTitle")}
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {tLanding("featuresSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.titleKey}
                className="feature-card border-0 shadow-lg hover:shadow-xl bg-white dark:bg-card"
              >
                <CardContent className="pt-8 pb-6 px-6">
                  <div className={`rounded-2xl bg-gradient-to-br ${feature.gradient} w-14 h-14 flex items-center justify-center mb-5 shadow-lg`}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-foreground">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(feature.descriptionKey)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
