"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  BookOpen, 
  Mic, 
  Headphones,
  Printer
} from "lucide-react";
import { useTranslations } from "next-intl";

export function HeroSection() {
  const t = useTranslations("landing");
  
  return (
    <section className="relative overflow-hidden hero-gradient min-h-[90vh] flex items-center">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="flex flex-col gap-6 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center justify-center lg:justify-start">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-white/80 dark:bg-background/80 backdrop-blur-sm px-4 py-2 text-sm font-medium shadow-sm">
                <Sparkles className="mr-2 h-4 w-4 text-primary" />
                <span className="text-primary">{t("badge")}</span>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="text-foreground">{t("headline")}</span>
              <br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                {t("headlineHighlight")}
              </span>
            </h1>

            {/* Description */}
            <p className="max-w-xl text-lg sm:text-xl text-muted-foreground leading-relaxed mx-auto lg:mx-0">
              {t("description")}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-2 justify-center lg:justify-start">
              <SignedOut>
                <Link href="/sign-up">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto min-w-[200px] text-base h-12 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  >
                    {t("startWritingFree")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/stories/public">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto min-w-[200px] text-base h-12 border-2"
                  >
                    {t("exploreStories")}
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/create">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto min-w-[200px] text-base h-12 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  >
                    {t("createNewStory")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto min-w-[200px] text-base h-12 border-2"
                  >
                    {t("myDashboard")}
                  </Button>
                </Link>
              </SignedIn>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>{t("freeToStart")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>{t("aiPoweredWriting")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span>{t("multiLanguageSupport")}</span>
              </div>
            </div>
          </div>

          {/* Right Content - Feature Preview Cards */}
          <div className="hidden lg:block relative">
            <div className="relative w-full max-w-lg mx-auto">
              {/* Main card */}
              <div className="glass-card rounded-2xl p-6 shadow-2xl animate-float">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{t("writeYourStory")}</h3>
                    <p className="text-sm text-muted-foreground">{t("aiAssisted")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-primary/20 rounded-full w-full" />
                  <div className="h-3 bg-primary/15 rounded-full w-4/5" />
                  <div className="h-3 bg-primary/10 rounded-full w-3/5" />
                </div>
              </div>

              {/* Floating cards */}
              <div className="absolute -top-4 -right-4 glass-card rounded-xl p-4 shadow-xl" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{t("voiceInput")}</span>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 glass-card rounded-xl p-4 shadow-xl" style={{ animationDelay: '2s' }}>
                <div className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{t("audioNarration")}</span>
                </div>
              </div>

              <div className="absolute top-1/2 -right-8 glass-card rounded-xl p-4 shadow-xl" style={{ animationDelay: '3s' }}>
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">{t("printBooks")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
