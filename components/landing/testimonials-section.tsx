"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";
import { useTranslations } from "next-intl";

interface Testimonial {
  nameKey: string;
  locationKey: string;
  quoteKey: string;
  avatar: string;
}

const testimonials: Testimonial[] = [
  {
    nameKey: "testimonial1Name",
    locationKey: "testimonial1Location",
    quoteKey: "testimonial1Quote",
    avatar: "PS",
  },
  {
    nameKey: "testimonial2Name",
    locationKey: "testimonial2Location",
    quoteKey: "testimonial2Quote",
    avatar: "RK",
  },
  {
    nameKey: "testimonial3Name",
    locationKey: "testimonial3Location",
    quoteKey: "testimonial3Quote",
    avatar: "AD",
  },
];

export function TestimonialsSection() {
  const t = useTranslations("landing.testimonials");
  const tLanding = useTranslations("landing");

  return (
    <section className="py-20 sm:py-24 md:py-32 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 sm:mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {tLanding("testimonialsLabel")}
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-foreground">
            {tLanding("testimonialsTitle")}
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {tLanding("testimonialsSubtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="relative border-0 shadow-lg hover:shadow-xl transition-shadow bg-white dark:bg-card"
            >
              <CardContent className="pt-8 pb-6 px-6">
                {/* Quote icon */}
                <div className="absolute -top-4 left-6">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg">
                    <Quote className="h-5 w-5 text-white" />
                  </div>
                </div>

                {/* Stars */}
                <div className="flex gap-1 mb-4 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>

                {/* Quote */}
                <p className="text-muted-foreground mb-6 leading-relaxed italic">
                  &ldquo;{t(testimonial.quoteKey)}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-4 pt-4 border-t border-border">
                  <div className="rounded-full bg-gradient-to-br from-primary to-blue-400 w-12 h-12 flex items-center justify-center font-semibold text-white shadow-md">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {t(testimonial.nameKey)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(testimonial.locationKey)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
