"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Eye, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type PublicStory = {
    id: string;
    title: string;
    storyType: 'life_story' | 'blog_story';
    summarySnippet: string;
    authorName: string;
    viewCount: number;
    likeCount: number;
    thumbnailImageUrl?: string;
};

export default function PublicStoriesPreview() {
    const [stories, setStories] = useState<PublicStory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStories = async () => {
            try {
                const res = await fetch("/api/stories/public?limit=6");
                if (res.ok) {
                    const data = await res.json();
                    setStories(data.slice(0, 6));
                }
            } catch (error) {
                console.error("Failed to fetch public stories:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStories();
    }, []);

    return (
        <section id="stories" className="py-16 md:py-20 lg:py-24 xl:py-32 bg-muted/30 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,111,71,0.05),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(201,168,106,0.05),transparent_50%)]" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-10 md:mb-12 lg:mb-16">
                    <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
                        Community Stories
                    </span>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-foreground mb-4">
                        Stories From Our Community
                    </h2>
                    <p className="text-base md:text-lg text-muted-foreground/80">
                        Discover inspiring stories shared by our community. Read, like, and connect with authors.
                    </p>
                </div>

                {/* Stories Grid */}
                {isLoading ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl mx-auto">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i} className="h-full">
                                <CardHeader className="pb-3">
                                    <Skeleton className="h-5 w-20 mb-2" />
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-4 w-full mb-2" />
                                    <Skeleton className="h-4 w-full mb-2" />
                                    <Skeleton className="h-4 w-3/4" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : stories.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl mx-auto">
                        {stories.map((story, index) => (
                            <motion.div
                                key={story.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: index * 0.1 }}
                            >
                                <Link href={`/story/${story.id}`}>
                                    <Card className="h-full hover:shadow-lg hover:border-primary/30 transition-all cursor-pointer group">
                                        <CardHeader className="pb-3">
                                            <Badge variant="secondary" className="w-fit mb-2">
                                                {story.storyType === "life_story" ? "Life Story" : "Creative Story"}
                                            </Badge>
                                            <h3 className="font-serif font-bold text-lg group-hover:text-primary transition-colors line-clamp-2">
                                                {story.title}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">by {story.authorName}</p>
                                        </CardHeader>
                                        <CardContent>
                                            <p className="text-sm text-muted-foreground/80 line-clamp-3 mb-4">
                                                {story.summarySnippet}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Eye className="h-3 w-3" />
                                                    {story.viewCount}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Heart className="h-3 w-3" />
                                                    {story.likeCount}
                                                </span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12">
                        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground mb-4">
                            No public stories yet. Be the first to share your story!
                        </p>
                    </div>
                )}

                {/* View All Button */}
                <div className="text-center mt-10 md:mt-12">
                    <Link href="/stories/public">
                        <Button size="lg" variant="outline" className="gap-2">
                            View All Stories
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    );
}
