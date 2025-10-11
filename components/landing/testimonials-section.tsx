import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

interface Testimonial {
  name: string;
  location: string;
  initial: string;
  quote: string;
}

const testimonials: Testimonial[] = [
  {
    name: "Priya Sharma",
    location: "Mumbai, India",
    initial: "P",
    quote:
      "Writing my life story helped me process decades of experiences. The AI assistance made it so easy to express thoughts I struggled to put into words. This platform changed my perspective on my own journey.",
  },
  {
    name: "Rajesh Kumar",
    location: "Chennai, India",
    initial: "R",
    quote:
      "The voice input feature is incredible! I could tell my grandmother's stories in Tamil, and the platform transcribed everything perfectly. Now we have a printed book that our whole family treasures.",
  },
  {
    name: "Ananya Desai",
    location: "Bangalore, India",
    initial: "A",
    quote:
      "As a creative writer, I love how the AI helps me overcome writer's block. The audio narration feature lets me listen to my stories and catch issues I miss when reading. Absolutely game-changing!",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 sm:py-20 md:py-24 bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Stories That Transform Lives
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Hear from our community of storytellers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.name} className="relative">
              <CardContent className="pt-6">
                <Quote className="h-8 w-8 text-primary/20 mb-4" />
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4 fill-primary text-primary"
                    />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 w-10 h-10 flex items-center justify-center font-semibold text-primary">
                    {testimonial.initial}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {testimonial.location}
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
