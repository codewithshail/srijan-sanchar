import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { ne, and, or, ilike, eq, desc, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const storyType = searchParams.get('storyType') || '';
        const sortBy = searchParams.get('sortBy') || 'newest';
        const author = searchParams.get('author') || '';

        // Build where conditions
        let whereConditions = [
            eq(stories.status, 'published'),
            ne(stories.visibility, 'private')
        ];

        // Add search condition
        if (search) {
            whereConditions.push(
                or(
                    ilike(stories.title, `%${search}%`),
                    ilike(stories.content, `%${search}%`)
                )!
            );
        }

        // Add story type filter
        if (storyType && (storyType === 'life_story' || storyType === 'blog_story')) {
            whereConditions.push(eq(stories.storyType, storyType));
        }

        // Build order by
        let orderBy;
        switch (sortBy) {
            case 'oldest':
                orderBy = [asc(stories.publishedAt)];
                break;
            case 'mostViewed':
                orderBy = [desc(stories.viewCount)];
                break;
            case 'title':
                orderBy = [asc(stories.title)];
                break;
            default: // newest
                orderBy = [desc(stories.publishedAt)];
        }

        const publicStories = await db.query.stories.findMany({
            where: and(...whereConditions),
            with: {
                summary: { columns: { userSummary: true } },
                owner: { 
                    columns: { 
                        id: true, 
                        firstName: true, 
                        lastName: true 
                    } 
                }
            },
            orderBy,
            limit: 50,
        });

        // Filter by author name if specified
        let filteredStories = publicStories;
        if (author) {
            filteredStories = publicStories.filter(story => {
                const owner = Array.isArray(story.owner) ? story.owner[0] : story.owner;
                if (!owner) return false;
                const fullName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim().toLowerCase();
                return fullName.includes(author.toLowerCase());
            });
        }

        const formattedStories = filteredStories.map(s => {
            const owner = Array.isArray(s.owner) ? s.owner[0] : s.owner;
            const summary = Array.isArray(s.summary) ? s.summary[0] : s.summary;
            return {
                id: s.id,
                title: s.title || 'Untitled Story',
                content: s.content,
                storyType: s.storyType,
                summarySnippet: summary?.userSummary?.substring(0, 150) + '...' || 
                               s.content?.substring(0, 150) + '...' || 
                               'No preview available',
                visibility: s.visibility,
                authorName: owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Anonymous' : 'Anonymous',
                publishedAt: s.publishedAt,
                viewCount: s.viewCount,
                listenCount: s.listenCount,
                thumbnailImageUrl: s.thumbnailImageUrl,
                bannerImageUrl: s.bannerImageUrl,
            };
        });

        return NextResponse.json(formattedStories);
    } catch (error) {
        console.error("[GET_PUBLIC_STORIES_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}