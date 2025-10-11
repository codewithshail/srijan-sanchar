import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

interface Step {
  number: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: "Sign Up Free",
    description:
      "Create your account in seconds. No credit card required to start writing.",
  },
  {
    number: 2,
    title: "Choose Your Story Type",
    description:
      "Select between therapeutic life stories or creative writing. Start with what resonates.",
  },
  {
    number: 3,
    title: "Write with AI Help",
    description:
      "Use voice input, AI suggestions, and smart editing tools to craft your perfect story.",
  },
  {
    number: 4,
    title: "Publish & Share",
    description:
      "Share online, create audiobooks, or order printed copies. Your story, your way.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-secondary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            How It Works
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Four simple steps to create and share your story
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-primary text-primary-foreground w-16 h-16 flex items-center justify-center text-2xl font-bold mb-4 shadow-lg">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
              {/* Connector line for desktop - only show if not last item */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-primary/30" />
              )}
            </div>
          ))}
        </div>

        {/* CTA after How It Works */}
        <div className="text-center mt-12">
          <SignedOut>
            <Link href="/sign-up">
              <Button size="lg" className="text-base">
                Start Your Journey Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/create">
              <Button size="lg" className="text-base">
                Create Your First Story
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </SignedIn>
        </div>
      </div>
    </section>
  );
}
