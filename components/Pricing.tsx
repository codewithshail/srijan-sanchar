"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const plans = [
    {
        name: "Starter",
        price: "Free",
        description: "Perfect for trying out memory recording.",
        features: [
            "1 Story Project",
            "Basic Voice-to-Text",
            "5 Photo Uploads",
            "Digital Export (PDF)",
            "Standard Support"
        ],
        cta: "Start Free",
        popular: false,
        href: "/sign-up",
    },
    {
        name: "Heirloom",
        price: "₹999",
        period: "/month",
        description: "For those serious about capturing a full life story.",
        features: [
            "Unlimited Story Projects",
            "Advanced AI Editing & Prompts",
            "Unlimited Photos",
            "Collaborate with Family",
            "Priority Support",
            "1 Printed Book Credit/Year"
        ],
        cta: "Start Heirloom",
        popular: true,
        href: "/sign-up?plan=heirloom",
    },
    {
        name: "Legacy",
        price: "₹14,999",
        period: "/lifetime",
        description: "One-time payment for lifetime access.",
        features: [
            "Everything in Heirloom",
            "Lifetime Access",
            "Personal Story Concierge",
            "Premium Hardcover Book",
            "Video Interview Session",
            "Digital Time Capsule"
        ],
        cta: "Get Lifetime Access",
        popular: false,
        href: "/sign-up?plan=legacy",
    },
];

export default function Pricing() {
    return (
        <section id="pricing" className="py-16 md:py-20 lg:py-24 xl:py-32 bg-accent/20">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12 lg:mb-16">
                    <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
                        Pricing Plans
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4">
                        Simple, Transparent Pricing
                    </h2>
                    <p className="text-base md:text-lg text-muted-foreground/80">
                        Choose the plan that fits your family's needs. No hidden fees.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
                    {plans.map((plan, index) => (
                        <Card
                            key={index}
                            className={cn(
                                "relative flex flex-col h-full border-none shadow-md hover:shadow-xl transition-all duration-300",
                                plan.popular
                                    ? "bg-background ring-2 ring-primary scale-100 md:scale-105 z-10 shadow-lg"
                                    : "bg-card/80"
                            )}
                        >
                            {plan.popular && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-primary text-primary-foreground hover:bg-primary px-4 py-1.5 text-sm font-semibold shadow-md">
                                        Most Popular
                                    </Badge>
                                </div>
                            )}

                            <CardHeader className={cn("pt-8", plan.popular && "pt-10")}>
                                <CardTitle className="text-2xl font-serif font-bold text-foreground">
                                    {plan.name}
                                </CardTitle>
                                <CardDescription className="min-h-[48px] mt-2 text-base">
                                    {plan.description}
                                </CardDescription>
                                <div className="mt-6 pb-4 border-b border-border/50">
                                    <span className="text-4xl lg:text-5xl font-bold text-foreground">{plan.price}</span>
                                    {plan.period && (
                                        <span className="text-base text-muted-foreground ml-1">{plan.period}</span>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="flex-grow pt-4">
                                <ul className="space-y-4">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-foreground/80">
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                                <Check className="w-3 h-3 text-primary" />
                                            </div>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter className="mt-auto pb-8">
                                <Link href={plan.href} className="w-full">
                                    <Button
                                        className={cn(
                                            "w-full h-12 text-base font-semibold transition-all",
                                            plan.popular
                                                ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                                                : "bg-foreground/5 text-foreground hover:bg-foreground/10 border border-border"
                                        )}
                                    >
                                        {plan.cta}
                                    </Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                {/* Trust badges */}
                <div className="mt-16 text-center">
                    <p className="text-sm text-muted-foreground mb-4">Trusted by 10,000+ families worldwide</p>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground/50">
                        <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary" />
                            <span className="text-sm">30-day money back</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary" />
                            <span className="text-sm">Cancel anytime</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary" />
                            <span className="text-sm">Bank-grade security</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
