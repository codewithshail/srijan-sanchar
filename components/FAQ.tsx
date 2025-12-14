"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

const faqs = [
    {
        question: "How does the voice-to-story feature work?",
        answer: "Simply record your voice answering our prompts. Our AI transcribes it, cleans up the 'umms' and 'ahhs', and structures it into a readable story format while keeping your unique tone.",
    },
    {
        question: "Is my data private and secure?",
        answer: "Absolutely. We use bank-level encryption to store your stories. You have full ownership of your content, and we never share your personal data with third parties.",
    },
    {
        question: "Can I print a physical book?",
        answer: "Yes! You can order beautiful hardcover or softcover books directly from the platform. Use our layout tools to add photos and customize the design before printing.",
    },
    {
        question: "What languages do you support?",
        answer: "We currently support English, Hindi, Marathi, Bengali, and 8 other Indian languages. You can even mix languages within a story (Hinglish, etc.), and our system handles it perfectly.",
    },
    {
        question: "Can I invite family members to contribute?",
        answer: "Yes, collaboration is a core feature. You can invite children, grandchildren, or siblings to add their own memories, photos, or comments to your stories.",
    },
    {
        question: "Is there a limit to how many stories I can write?",
        answer: "The Free plan includes one story project. Heirloom and Legacy plans offer unlimited stories and storage for photos and voice recordings.",
    },
    {
        question: "Do I need a computer to use StoryWeave?",
        answer: "No, our platform is fully mobile-responsive. You can use it easily on a smartphone, tablet, or laptop.",
    },
    {
        question: "What happens to my data if I stop paying?",
        answer: "We never delete your data without warning. If you cancel your subscription, your stories remain view-only. You can always export them as a PDF before cancelling.",
    },
];

export default function FAQ() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredFaqs = faqs.filter(
        (faq) =>
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <section id="faq" className="py-16 md:py-20 lg:py-24 xl:py-32 bg-background">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-10 md:mb-12 lg:mb-16">
                        <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
                            FAQ
                        </span>
                        <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4">
                            Frequently Asked Questions
                        </h2>
                        <p className="text-base md:text-lg text-muted-foreground/80">
                            Everything you need to know about preserving your legacy.
                        </p>
                    </div>

                    <div className="relative max-w-md mx-auto mb-10 md:mb-12">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search questions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-12 h-14 bg-accent/20 border-border/50 focus:border-primary focus:ring-primary text-base rounded-xl"
                        />
                    </div>

                    <Accordion type="single" collapsible className="w-full space-y-3 md:space-y-4">
                        {filteredFaqs.map((faq, index) => (
                            <AccordionItem
                                key={index}
                                value={`item-${index}`}
                                className="border border-border/50 rounded-xl px-6 bg-card shadow-sm hover:shadow-md transition-shadow data-[state=open]:shadow-md data-[state=open]:border-primary/30"
                            >
                                <AccordionTrigger className="text-left text-base lg:text-lg font-medium hover:no-underline hover:text-primary py-4">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground/90 leading-relaxed pb-4 text-base">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                {filteredFaqs.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <p className="text-lg">No questions found matching your search.</p>
                        <p className="text-sm mt-2">Try a different search term.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
