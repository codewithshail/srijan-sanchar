"use client";

import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const testimonials = [
    {
        name: "Ramesh Gupta",
        age: 68,
        location: "Mumbai",
        quote: "I always wanted to write my biography but didn't know where to start. StoryWeave made it so natural—I just spoke, and it became a book.",
        rating: 5,
    },
    {
        name: "Sarah Jenkins",
        age: 34,
        location: "London",
        quote: "We gifted this to my grandmother for her 80th birthday. Discovering stories about her childhood in pre-independence India has been priceless.",
        rating: 5,
    },
    {
        name: "Meera Patel",
        age: 72,
        location: "Ahmedabad",
        quote: "The voice recording feature is a blessing. My hands shake when I type, but now I can capture my recipes and memories without pain.",
        rating: 5,
    },
    {
        name: "Arjun Singh",
        age: 45,
        location: "Delhi",
        quote: "Professional, secure, and beautiful. The final printed book is of heirloom quality. Highly recommended for every family.",
        rating: 5,
    },
    {
        name: "Priya Sharma",
        age: 56,
        location: "Bangalore",
        quote: "My children now know about their great-grandparents' journey during partition. These stories would have been lost forever without StoryWeave.",
        rating: 5,
    },
];

export default function Testimonials() {
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true, align: "start", slidesToScroll: 1 },
        [Autoplay({ delay: 6000, stopOnInteraction: true })]
    );
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(true);

    useEffect(() => {
        if (!emblaApi) return;

        const onSelect = () => {
            setSelectedIndex(emblaApi.selectedScrollSnap());
            setCanScrollPrev(emblaApi.canScrollPrev());
            setCanScrollNext(emblaApi.canScrollNext());
        };

        emblaApi.on("select", onSelect);
        onSelect();

        return () => {
            emblaApi.off("select", onSelect);
        };
    }, [emblaApi]);

    const scrollPrev = () => emblaApi?.scrollPrev();
    const scrollNext = () => emblaApi?.scrollNext();
    const scrollTo = (index: number) => emblaApi?.scrollTo(index);

    return (
        <section id="testimonials" className="py-16 md:py-20 lg:py-24 xl:py-32 bg-background relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12 lg:mb-16">
                    <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-2 block">
                        Testimonials
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4">
                        Voices of Our Community
                    </h2>
                    <p className="text-lg text-muted-foreground/80">
                        Join thousands of families preserving their heritage with StoryWeave.
                    </p>
                </div>

                <div className="relative max-w-7xl mx-auto">
                    {/* Navigation Buttons */}
                    <div className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={scrollPrev}
                            disabled={!canScrollPrev}
                            className="w-12 h-12 rounded-full bg-background shadow-lg border-border/50 hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                    </div>
                    <div className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={scrollNext}
                            disabled={!canScrollNext}
                            className="w-12 h-12 rounded-full bg-background shadow-lg border-border/50 hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Carousel */}
                    <div className="overflow-hidden" ref={emblaRef}>
                        <div className="flex">
                            {testimonials.map((testimonial, index) => (
                                <div
                                    key={index}
                                    className="flex-[0_0_100%] min-w-0 sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] pl-4 first:pl-0 sm:first:pl-4"
                                >
                                    <div className="h-full p-2">
                                        <Card className="h-full bg-card border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                                            <CardContent className="p-6 lg:p-8 flex flex-col h-full min-h-[300px] md:min-h-[320px]">
                                                {/* Quote Icon */}
                                                <div className="mb-4">
                                                    <Quote className="w-10 h-10 text-primary/20" />
                                                </div>

                                                {/* Quote Text */}
                                                <blockquote className="text-foreground/90 font-serif italic text-base lg:text-lg mb-6 flex-grow leading-relaxed">
                                                    "{testimonial.quote}"
                                                </blockquote>

                                                {/* Author Info */}
                                                <div className="flex items-center gap-4 pt-4 border-t border-border/50 mt-auto">
                                                    <Avatar className="w-12 h-12 border-2 border-primary/20">
                                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                                                            {testimonial.name[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-foreground text-sm">
                                                            {testimonial.name}
                                                        </h4>
                                                        <p className="text-xs text-muted-foreground">
                                                            {testimonial.age} • {testimonial.location}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Rating */}
                                                <div className="flex gap-1 mt-4">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            className={cn(
                                                                "w-4 h-4",
                                                                i < testimonial.rating
                                                                    ? "fill-primary text-primary"
                                                                    : "text-muted"
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Dots Navigation */}
                    <div className="flex justify-center gap-2 mt-8">
                        {testimonials.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => scrollTo(index)}
                                className={cn(
                                    "h-2.5 rounded-full transition-all duration-300",
                                    index === selectedIndex
                                        ? "bg-primary w-8"
                                        : "bg-primary/20 hover:bg-primary/40 w-2.5"
                                )}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
