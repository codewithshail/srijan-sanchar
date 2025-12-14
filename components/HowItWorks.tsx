"use client";

import { motion } from "framer-motion";
import { PenLine, Sparkles, BookOpen } from "lucide-react";

const steps = [
    {
        icon: PenLine,
        title: "Share Your Memories",
        description: "Start by answering simple prompts or speaking your thoughts. Our AI helps you recall forgotten details.",
        color: "from-primary/20 to-primary/5",
    },
    {
        icon: Sparkles,
        title: "AI Weaves the Magic",
        description: "We transform your fragmented memories into beautifully written narratives, preserving your unique voice.",
        color: "from-secondary/20 to-secondary/5",
    },
    {
        icon: BookOpen,
        title: "Preserve Your Legacy",
        description: "Receive a timeless digital or printed book to share with children, grandchildren, and future generations.",
        color: "from-primary/15 to-secondary/10",
    },
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="py-16 md:py-20 lg:py-24 xl:py-32 bg-background relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,111,71,0.05),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(201,168,106,0.05),transparent_50%)]" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12 lg:mb-16">
                    <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
                        How It Works
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4">
                        From Memory to Masterpiece
                    </h2>
                    <p className="text-base md:text-lg text-muted-foreground/80">
                        Preserving your life story has never been this easy. We guide you every step of the way.
                    </p>
                </div>

                <div className="relative max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8 relative z-10">
                        {steps.map((step, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 30 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: "-50px" }}
                                transition={{ duration: 0.5, delay: index * 0.15 }}
                                className="flex flex-col items-center text-center group"
                            >
                                {/* Step Circle */}
                                <div className="relative mb-6 md:mb-8">
                                    <div className={`w-28 h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 bg-gradient-to-br ${step.color} rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-500`}>
                                        <div className="w-20 h-20 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-background rounded-full flex items-center justify-center shadow-inner">
                                            <step.icon className="w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 text-primary group-hover:scale-110 transition-transform duration-300" />
                                        </div>
                                    </div>

                                    {/* Step Number Badge */}
                                    <div className="absolute -top-1 -right-1 w-7 h-7 md:w-8 md:h-8 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center font-bold text-sm md:text-base shadow-lg border-2 border-background">
                                        {index + 1}
                                    </div>
                                </div>

                                {/* Content */}
                                <h3 className="text-xl lg:text-2xl font-serif font-bold text-foreground mb-3">
                                    {step.title}
                                </h3>
                                <p className="text-muted-foreground/80 leading-relaxed max-w-[280px]">
                                    {step.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
