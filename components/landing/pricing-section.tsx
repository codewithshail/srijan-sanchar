import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface PricingFeature {
  text: string;
  bold?: boolean;
}

interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: PricingFeature[];
  popular?: boolean;
  ctaText: {
    signedOut: string;
    signedIn: string;
  };
  ctaLink: {
    signedOut: string;
    signedIn: string;
  };
  variant?: "outline" | "default";
}

const pricingPlans: PricingPlan[] = [
  {
    name: "Free Forever",
    price: "₹0",
    description: "Perfect for getting started",
    features: [
      { text: "Unlimited story creation" },
      { text: "AI writing assistance" },
      { text: "Voice input in all languages" },
      { text: "Publish online" },
      { text: "Audio narration" },
      { text: "Share on social media" },
    ],
    ctaText: {
      signedOut: "Get Started Free",
      signedIn: "Start Writing",
    },
    ctaLink: {
      signedOut: "/sign-up",
      signedIn: "/create",
    },
    variant: "outline",
  },
  {
    name: "Printed Book",
    price: "₹999",
    description: "Per printed copy",
    popular: true,
    features: [
      { text: "Everything in Free, plus:", bold: true },
      { text: "Professional hardcover or paperback" },
      { text: "AI-generated images included" },
      { text: "Premium paper quality" },
      { text: "Multiple size options (A5, A4)" },
      { text: "Delivered to your doorstep" },
    ],
    ctaText: {
      signedOut: "Get Started",
      signedIn: "Create & Order",
    },
    ctaLink: {
      signedOut: "/sign-up",
      signedIn: "/create",
    },
    variant: "default",
  },
];

export function PricingSection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-secondary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade when you&apos;re ready to print
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={`border-2 ${plan.popular ? "border-primary shadow-lg relative" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
              )}
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="text-4xl font-bold mb-2">{plan.price}</div>
                  <p className="text-muted-foreground">{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <span className={feature.bold ? "font-semibold" : ""}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
                <SignedOut>
                  <Link href={plan.ctaLink.signedOut} className="w-full block">
                    <Button
                      variant={plan.variant}
                      size="lg"
                      className="w-full"
                    >
                      {plan.ctaText.signedOut}
                      {plan.variant === "default" && (
                        <ArrowRight className="ml-2 h-5 w-5" />
                      )}
                    </Button>
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link href={plan.ctaLink.signedIn} className="w-full block">
                    <Button
                      variant={plan.variant}
                      size="lg"
                      className="w-full"
                    >
                      {plan.ctaText.signedIn}
                      {plan.variant === "default" && (
                        <ArrowRight className="ml-2 h-5 w-5" />
                      )}
                    </Button>
                  </Link>
                </SignedIn>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All prices in Indian Rupees (₹). Shipping charges may apply for print
          orders.
        </p>
      </div>
    </section>
  );
}
