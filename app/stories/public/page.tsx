"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, Search, Filter, Eye, Headphones, Calendar, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

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
        <div className="container py-8">
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
                        <Select value={storyTypeFilter} onValueChange={setStoryTypeFilter}>
                            <SelectTrigger className="w-40">
                                <Filter className="h-4 w-4" />
                                <SelectValue placeholder="Story Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="">All Types</SelectItem>
                                <SelectItem value="life_story">Life Stories</SelectItem>
                                <SelectItem value="blog_story">Blog Stories</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Sort By */}
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="Sort by" />
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
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => <StorySkeleton key={i} />)}
                </div>
            )}
            
            {/* Stories Grid */}
            {!isLoading && (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {stories?.map(story => (
                        <StoryCard key={story.id} story={story} />
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

function StoryCard({ story }: { story: PublicStory }) {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    return (
        <Link href={`/story/${story.id}`}>
            <Card className="h-full flex flex-col hover:border-primary transition-colors duration-200 group">
                {/* Thumbnail Image */}
                {story.thumbnailImageUrl && (
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                        <img 
                            src={story.thumbnailImageUrl} 
                            alt={story.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                    </div>
                )}
                
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                            {story.storyType === 'life_story' ? 'Life Story' : 'Blog Story'}
                        </Badge>
                    </div>
                    <CardTitle className="flex items-start gap-2 text-lg leading-tight">
                        <BookOpen className="h-5 w-5 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{story.title}</span>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3" />
                        {story.authorName}
                    </CardDescription>
                </CardHeader>
                
                <CardContent className="flex-grow pb-4">
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                        {story.summarySnippet}
                    </p>
                    
                    {/* Story Metadata */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {story.viewCount}
                            </div>
                            {story.listenCount > 0 && (
                                <div className="flex items-center gap-1">
                                    <Headphones className="h-3 w-3" />
                                    {story.listenCount}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(story.publishedAt)}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
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