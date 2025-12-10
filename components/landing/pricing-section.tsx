"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

export function PricingSection() {
  const t = useTranslations("landing.pricing");
  const tLanding = useTranslations("landing");

  const freeFeatures = [
    "unlimitedStories",
    "aiWritingAssistance",
    "voiceInputAllLanguages",
    "publishOnline",
    "audioNarration",
    "socialSharing",
  ];

  const printFeatures = [
    "everythingInFree",
    "professionalPrinting",
    "aiGeneratedImages",
    "premiumPaper",
    "multipleSizes",
    "doorstepDelivery",
  ];

  return (
    <section className="py-20 sm:py-24 md:py-32 bg-gradient-to-b from-background to-secondary/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 sm:mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {tLanding("pricingLabel")}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {tLanding("pricingTitle")}
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {tLanding("pricingSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <Card className="border-2 border-border shadow-lg hover:shadow-xl transition-shadow bg-white dark:bg-card">
            <CardContent className="pt-8 pb-8 px-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2 text-foreground">{t("freePlanName")}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-foreground">{t("freePlanPrice")}</span>
                </div>
                <p className="text-muted-foreground mt-2">{t("freePlanDesc")}</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{t(feature)}</span>
                  </li>
                ))}
              </ul>
              
              <SignedOut>
                <Link href="/sign-up" className="w-full block">
                  <Button variant="outline" size="lg" className="w-full h-12 text-base border-2">
                    {t("getStartedFree")}
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/create" className="w-full block">
                  <Button variant="outline" size="lg" className="w-full h-12 text-base border-2">
                    {t("startWriting")}
                  </Button>
                </Link>
              </SignedIn>
            </CardContent>
          </Card>

          {/* Print Plan */}
          <Card className="border-2 border-primary shadow-xl relative bg-white dark:bg-card overflow-hidden">
            {/* Popular badge */}
            <div className="absolute top-0 right-0">
              <div className="bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold rounded-bl-lg flex items-center gap-1">
                <Sparkles className="h-4 w-4" />
                {t("mostPopular")}
              </div>
            </div>
            
            <CardContent className="pt-8 pb-8 px-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2 text-foreground">{t("printPlanName")}</h3>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-primary">{t("printPlanPrice")}</span>
                  <span className="text-muted-foreground">{t("perCopy")}</span>
                </div>
                <p className="text-muted-foreground mt-2">{t("printPlanDesc")}</p>
              </div>
              
              <ul className="space-y-4 mb-8">
                {printFeatures.map((feature, index) => (
                  <li key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className={index === 0 ? "font-semibold text-foreground" : "text-foreground"}>
                      {t(feature)}
                    </span>
                  </li>
                ))}
              </ul>
              
              <SignedOut>
                <Link href="/sign-up" className="w-full block">
                  <Button size="lg" className="w-full h-12 text-base shadow-lg shadow-primary/25">
                    {t("getStarted")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link href="/create" className="w-full block">
                  <Button size="lg" className="w-full h-12 text-base shadow-lg shadow-primary/25">
                    {t("createAndOrder")}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </SignedIn>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          {t("pricingNote")}
        </p>
      </div>
    </section>
  );
}
