"use client";

import { motion } from "framer-motion";
import { Mic, Languages, Lock, Heart, Edit3, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
    {
        icon: Mic,
        title: "Voice-to-Story",
        description: "Simply speak your memories. Our technology transcribes and edits your spoken words into beautiful prose.",
        gradient: "from-primary/20 to-primary/5",
    },
    {
        icon: Languages,
        title: "Multi-Language Support",
        description: "Write in English, Hindi, or your mother tongue. We honour the nuances of Indian languages.",
        gradient: "from-secondary/20 to-secondary/5",
    },
    {
        icon: Lock,
        title: "Private & Secure",
        description: "Your stories are your legacy. We use bank-grade encryption to keep your memories safe.",
        gradient: "from-primary/15 to-secondary/10",
    },
    {
        icon: Heart,
        title: "Family Collaboration",
        description: "Invite family members to add their perspectives or photos to your shared stories.",
        gradient: "from-secondary/15 to-primary/10",
    },
    {
        icon: Edit3,
        title: "AI Writing Assistant",
        description: "Stuck on a detail? Our AI suggests prompts and helps expand your thoughts naturally.",
        gradient: "from-primary/20 to-primary/5",
    },
    {
        icon: ImageIcon,
        title: "Photo Integration",
        description: "Weave cherished family photos directly into your text for a rich storytelling experience.",
        gradient: "from-secondary/20 to-secondary/5",
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function Features() {
    return (
        <section id="features" className="py-16 md:py-20 lg:py-24 xl:py-32 bg-accent/20 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12 lg:mb-16">
                    <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
                        Why Choose StoryWeave
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4">
                        Designed for Your Legacy
                    </h2>
                    <p className="text-base md:text-lg text-muted-foreground/80">
                        We've built tools that make preserving your life's journey effortless and beautiful.
                    </p>
                </div>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-50px" }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto"
                >
                    {features.map((feature, index) => (
                        <motion.div key={index} variants={itemVariants} className="h-full">
                            <Card className="h-full flex flex-col border-none shadow-md hover:shadow-xl transition-all duration-300 bg-background group hover:-translate-y-1 p-6 lg:p-8">
                                <CardHeader className="pb-4 p-0">
                                    <div className={`w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                        <feature.icon className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
                                    </div>
                                    <CardTitle className="font-serif text-xl lg:text-2xl text-foreground">
                                        {feature.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <p className="text-muted-foreground/80 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
