import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center py-12 px-4 sm:py-16 md:py-24 lg:py-32 min-h-[calc(100vh-4rem)]">
      {/* Badge */}
      <div className="rounded-full border bg-secondary px-4 py-1.5 text-sm text-secondary-foreground">
        Weaving Narratives, Shaping Futures
      </div>
      
      {/* Main Heading */}
      <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl max-w-5xl leading-tight">
        Change Your Story, Change Your Life
      </h1>
      
      {/* Description */}
      <p className="max-w-2xl text-muted-foreground text-base sm:text-lg md:text-xl leading-relaxed">
        Embark on a transformative journey. Craft your life narrative across 7 pivotal stages with AI-guided options, unlocking insights and paving the way for profound personal growth.
      </p>
      
      {/* Action Buttons - Properly centered */}
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 mt-2">
        <SignedIn>
          <Link href="/create">
            <Button size="lg" className="w-full sm:w-auto min-w-[200px]">
              Start Your Story <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px]">
              View Dashboard
            </Button>
          </Link>
          <Link href="/stories/public">
            <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px]">
              Explore Stories
            </Button>
          </Link>
        </SignedIn>
        <SignedOut>
          <Link href="/sign-in">
            <Button size="lg" className="w-full sm:w-auto min-w-[200px]">
              Get Started for Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </SignedOut>
      </div>
    </div>
  );
}