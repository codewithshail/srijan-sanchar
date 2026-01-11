"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Hero3DContainer from "@/components/Hero3DContainer";
import { StartWritingDialog } from "@/components/StartWritingDialog";

export default function Hero() {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <section className="relative pt-20 md:pt-24 lg:pt-28 pb-12 md:pb-16 lg:pb-20 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(139,111,71,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(201,168,106,0.06),transparent_50%)]" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-16 items-center">

          {/* Text Content */}
          <div className="space-y-6 md:space-y-8 relative text-center lg:text-left order-2 lg:order-1">
            <div className="inline-block px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm">
              ✨ Preserving Memories Across Generations
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold text-foreground leading-tight">
              Your Life Story, <br className="hidden sm:block" />
              <span className="text-primary italic">Beautifully Told.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground/90 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              We help you capture, organize, and publish your personal history.
              Simple, private, and designed for everyone.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                size="lg"
                onClick={() => setShowDialog(true)}
                className="w-full sm:w-auto h-11 sm:h-12 lg:h-14 px-6 sm:px-8 text-base sm:text-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
              >
                Start Writing Story
                <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <Link href="/stories/public">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto h-11 sm:h-12 lg:h-14 px-6 sm:px-8 text-base sm:text-lg border-2 border-border hover:bg-accent/50 text-foreground"
                >
                  Explore Stories
                </Button>
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-background bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xs font-bold text-primary"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <p className="font-medium">
                Trusted by <span className="text-foreground">10,000+</span> families
              </p>
            </div>
          </div>

          {/* 3D Visual */}
          <div className="relative order-1 lg:order-2 min-h-[350px] sm:min-h-[400px] md:min-h-[500px]">
            <div className="absolute inset-0 bg-gradient-to-tr from-accent/30 via-transparent to-primary/10 rounded-3xl blur-3xl -z-10 scale-110" />
            <Hero3DContainer />
          </div>
        </div>
      </div>

      {/* Destination Choice Dialog */}
      <StartWritingDialog open={showDialog} onOpenChange={setShowDialog} />
    </section>
  );
}
