import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-secondary/20 py-16 sm:py-20 md:py-28 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center gap-6 max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center rounded-full border bg-background px-4 py-1.5 text-sm font-medium shadow-sm">
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            Weaving Narratives, Shaping Futures
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Change Your Story,
            <br />
            <span className="text-primary">Change Your Life</span>
          </h1>

          {/* Description */}
          <p className="max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed">
            Transform your experiences into powerful narratives. Write with AI
            assistance, publish online, create audiobooks, and order beautiful
            printed copies.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4 w-full sm:w-auto">
            <SignedOut>
              <Link href="/sign-up" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:min-w-[200px] text-base"
                >
                  Start Writing Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/stories/public" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:min-w-[200px] text-base"
                >
                  Explore Stories
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/create" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:min-w-[200px] text-base"
                >
                  Create New Story
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:min-w-[200px] text-base"
                >
                  My Dashboard
                </Button>
              </Link>
            </SignedIn>
          </div>

          {/* Social Proof */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Free to start</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>AI-powered writing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Multi-language support</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
