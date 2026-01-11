import Link from "next/link";
import { ArrowRight } from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import PublicStoriesPreview from "@/components/PublicStoriesPreview";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "StoryWeave - Capture Your Life Story",
  description: "The professional, accessible platform for preserving family legacies. Turn your memories into a timeless book.",
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans selection:bg-primary/20 selection:text-primary-foreground">
      <Header />

      <main className="flex-grow">
        <Hero />
        <Features />
        <PublicStoriesPreview />
        <Testimonials />
        <Pricing />
        <FAQ />

        {/* Final CTA Section */}
        <section className="py-16 md:py-20 lg:py-24 xl:py-32 bg-gradient-to-br from-primary to-primary/90 text-primary-foreground relative overflow-hidden">
          {/* Decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
          </div>

          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-6">
                Ready to Write Your Chapter?
              </h2>
              <p className="text-xl opacity-90 mb-6 leading-relaxed">
                Don't let your stories fade away. Start recording your legacy today for your loved ones tomorrow.
              </p>
              <div className="mt-8 md:mt-10">
                <Link href="/sign-up">
                  <Button size="lg" variant="secondary" className="h-16 px-10 text-xl font-bold bg-background text-foreground hover:bg-background/90 shadow-2xl hover:shadow-xl transition-all">
                    Create Your Account Free
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
