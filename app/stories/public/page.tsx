"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, Filter, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ShareableStoryCard } from "@/components/shareable-story-card";

type PublicStory = {
    id: string;
    title: string;
    content?: string;
    storyType: 'life_story' | 'blog_story';
    summarySnippet: string;
    visibility: 'public_summary' | 'public_long';
    authorName: string;
    publishedAt: string;
    viewCount: number;
    listenCount: number;
    likeCount: number;
    shareCount: number;
    thumbnailImageUrl?: string;
    bannerImageUrl?: string;
};

export default function PublicStoriesPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [storyTypeFilter, setStoryTypeFilter] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [authorFilter, setAuthorFilter] = useState('');

    // Build query parameters
    const queryParams = useMemo(() => {
        const params = new URLSearchParams();
        if (searchTerm) params.set('search', searchTerm);
        if (storyTypeFilter) params.set('storyType', storyTypeFilter);
        if (sortBy) params.set('sortBy', sortBy);
        if (authorFilter) params.set('author', authorFilter);
        return params.toString();
    }, [searchTerm, storyTypeFilter, sortBy, authorFilter]);

    const { data: stories, isLoading, refetch } = useQuery<PublicStory[]>({
        queryKey: ['publicStories', queryParams],
        queryFn: async () => {
            const url = `/api/stories/public${queryParams ? `?${queryParams}` : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch public stories");
            return res.json();
        }
    });

    const clearFilters = () => {
        setSearchTerm('');
        setStoryTypeFilter('');
        setSortBy('newest');
        setAuthorFilter('');
    };

    const hasActiveFilters = searchTerm || storyTypeFilter || sortBy !== 'newest' || authorFilter;

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <header className="text-center mb-10">
                <h1 className="text-4xl font-bold tracking-tight">Explore Public Stories</h1>
                <p className="mt-2 text-lg text-muted-foreground">Discover the narratives and journeys shared by our community.</p>
            </header>

            {/* Search and Filter Controls */}
            <div className="mb-8 space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Search stories by title or content..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    {/* Author Filter */}
                    <div className="relative md:w-48">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Filter by author..."
                            value={authorFilter}
                            onChange={(e) => setAuthorFilter(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                        {/* Story Type Filter */}
                        <Select value={storyTypeFilter || "all"} onValueChange={(val) => setStoryTypeFilter(val === "all" ? "" : val)}>
                            <SelectTrigger className="w-40">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue>
                                    {storyTypeFilter === "life_story" ? "Life Stories" :
                                        storyTypeFilter === "blog_story" ? "Blog Stories" : "All Types"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="life_story">Life Stories</SelectItem>
                                <SelectItem value="blog_story">Blog Stories</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Sort By */}
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-40">
                                <SelectValue>
                                    {sortBy === "newest" ? "Newest First" :
                                        sortBy === "oldest" ? "Oldest First" :
                                            sortBy === "mostViewed" ? "Most Viewed" : "Title A-Z"}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="newest">Newest First</SelectItem>
                                <SelectItem value="oldest">Oldest First</SelectItem>
                                <SelectItem value="mostViewed">Most Viewed</SelectItem>
                                <SelectItem value="title">Title A-Z</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters} size="sm">
                            Clear Filters
                        </Button>
                    )}
                </div>

                {/* Active Filters Display */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap gap-2">
                        {searchTerm && (
                            <Badge variant="secondary">
                                Search: "{searchTerm}"
                            </Badge>
                        )}
                        {storyTypeFilter && (
                            <Badge variant="secondary">
                                Type: {storyTypeFilter === 'life_story' ? 'Life Stories' : 'Blog Stories'}
                            </Badge>
                        )}
                        {authorFilter && (
                            <Badge variant="secondary">
                                Author: "{authorFilter}"
                            </Badge>
                        )}
                        {sortBy !== 'newest' && (
                            <Badge variant="secondary">
                                Sort: {sortBy === 'oldest' ? 'Oldest First' :
                                    sortBy === 'mostViewed' ? 'Most Viewed' : 'Title A-Z'}
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 6 }).map((_, i) => <StorySkeleton key={i} />)}
                </div>
            )}

            {/* Stories Grid */}
            {!isLoading && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {stories?.map(story => (
                        <ShareableStoryCard
                            key={story.id}
                            story={{
                                id: story.id,
                                title: story.title,
                                storyType: story.storyType,
                                summarySnippet: story.summarySnippet,
                                thumbnailImageUrl: story.thumbnailImageUrl,
                                bannerImageUrl: story.bannerImageUrl,
                                authorName: story.authorName,
                                publishedAt: story.publishedAt,
                                viewCount: story.viewCount,
                                listenCount: story.listenCount,
                                likeCount: story.likeCount,
                                shareCount: story.shareCount,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Empty State */}
            {!isLoading && stories?.length === 0 && (
                <div className="text-center py-12">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-2xl font-semibold mb-2">
                        {hasActiveFilters ? 'No Stories Found' : 'The Library is Quiet'}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                        {hasActiveFilters
                            ? 'Try adjusting your search or filters to find more stories.'
                            : 'No public stories have been shared yet. Be the first!'
                        }
                    </p>
                    {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                            Clear All Filters
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}

function StorySkeleton() {
    return (
        <Card className="h-full flex flex-col">
            <div className="aspect-video w-full">
                <Skeleton className="w-full h-full rounded-t-lg" />
            </div>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex-grow pb-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-3">
                        <Skeleton className="h-3 w-8" />
                        <Skeleton className="h-3 w-8" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                </div>
            </CardContent>
        </Card>
    );
}