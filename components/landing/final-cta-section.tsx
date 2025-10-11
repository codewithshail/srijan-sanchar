import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";

export function FinalCTASection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Ready to Transform Your Story?
          </h2>
          <p className="text-lg sm:text-xl mb-8 opacity-90">
            Join thousands of storytellers who are documenting their journeys,
            sharing their wisdom, and creating lasting legacies.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <SignedOut>
              <Link href="/sign-up">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto text-base"
                >
                  Start Writing for Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/stories/public">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-base border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                >
                  Read Sample Stories
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/create">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto text-base"
                >
                  Create Your Story Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto text-base border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                >
                  Go to Dashboard
                </Button>
              </Link>
            </SignedIn>
          </div>
        </div>
      </div>
    </section>
  );
}
