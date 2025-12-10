"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight, UserPlus, FileText, Wand2, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";

interface Step {
  number: number;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
}

const steps: Step[] = [
  {
    number: 1,
    icon: UserPlus,
    titleKey: "step1Title",
    descriptionKey: "step1Desc",
  },
  {
    number: 2,
    icon: FileText,
    titleKey: "step2Title",
    descriptionKey: "step2Desc",
  },
  {
    number: 3,
    icon: Wand2,
    titleKey: "step3Title",
    descriptionKey: "step3Desc",
  },
  {
    number: 4,
    icon: Share2,
    titleKey: "step4Title",
    descriptionKey: "step4Desc",
  },
];

export function HowItWorksSection() {
  const t = useTranslations("landing.howItWorks");
  const tLanding = useTranslations("landing");

  return (
    <section className="py-20 sm:py-24 md:py-32 bg-gradient-to-b from-secondary/30 to-background relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, var(--primary) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 sm:mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {tLanding("howItWorksLabel")}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {tLanding("howItWorksTitle")}
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {tLanding("howItWorksSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto mb-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                <div className="flex flex-col items-center text-center">
                  {/* Step number with icon */}
                  <div className="relative mb-6">
                    <div className="rounded-full bg-primary text-primary-foreground w-20 h-20 flex items-center justify-center shadow-lg shadow-primary/30">
                      <Icon className="h-8 w-8" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white dark:bg-card border-2 border-primary flex items-center justify-center text-sm font-bold text-primary shadow-md">
                      {step.number}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-3 text-foreground">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {t(step.descriptionKey)}
                  </p>
                </div>
                
                {/* Connector line for desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-primary/10" />
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <SignedOut>
            <Link href="/sign-up">
              <Button size="lg" className="text-base h-12 px-8 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                {tLanding("startJourney")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/create">
              <Button size="lg" className="text-base h-12 px-8 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
                {tLanding("createFirstStory")}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </SignedIn>
        </div>
      </div>
    </section>
  );
}
