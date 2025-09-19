import { db } from "@/lib/db";
import { stories, users, summaries } from "@/lib/db/schema";
import { eq, ne, and, desc, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  try {
    const { storyId } = await params;

    // First, get the current story to understand its type and content
    const currentStory = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      with: {
        summary: true,
        owner: {
          columns: {
            firstName: true,
            lastName: true,
          }
        }
      }
    });

    if (!currentStory || currentStory.status !== 'published') {
      return NextResponse.json([]);
    }

    // Get related stories based on story type and recency
    // For now, we'll use a simple approach: same story type, different author, recently published
    const relatedStoriesQuery = db
      .select({
        id: stories.id,
        title: stories.title,
        thumbnailImageUrl: stories.thumbnailImageUrl,
        authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, 'Anonymous')`,
        publishedAt: stories.publishedAt,
        viewCount: stories.viewCount,
        storyType: stories.storyType,
      })
      .from(stories)
      .innerJoin(users, eq(stories.ownerId, users.id))
      .where(
        and(
          ne(stories.id, storyId), // Not the current story
          eq(stories.status, 'published'), // Only published stories
          eq(stories.storyType, currentStory.storyType), // Same story type
          ne(stories.ownerId, currentStory.ownerId) // Different author
        )
      )
      .orderBy(desc(stories.publishedAt))
      .limit(6);

    const relatedStories = await relatedStoriesQuery;

    // If we don't have enough stories of the same type, fill with other published stories
    if (relatedStories.length < 3) {
      const additionalStoriesQuery = db
        .select({
          id: stories.id,
          title: stories.title,
          thumbnailImageUrl: stories.thumbnailImageUrl,
          authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.firstName}, 'Anonymous')`,
          publishedAt: stories.publishedAt,
          viewCount: stories.viewCount,
          storyType: stories.storyType,
        })
        .from(stories)
        .innerJoin(users, eq(stories.ownerId, users.id))
        .where(
          and(
            ne(stories.id, storyId), // Not the current story
            eq(stories.status, 'published'), // Only published stories
            ne(stories.storyType, currentStory.storyType), // Different story type
            ne(stories.ownerId, currentStory.ownerId) // Different author
          )
        )
        .orderBy(desc(stories.viewCount), desc(stories.publishedAt))
        .limit(6 - relatedStories.length);

      const additionalStories = await additionalStoriesQuery;
      relatedStories.push(...additionalStories);
    }

    // Format the response
    const formattedStories = relatedStories.map(story => ({
      id: story.id,
      title: story.title || 'Untitled Story',
      thumbnailImageUrl: story.thumbnailImageUrl,
      authorName: story.authorName,
      publishedAt: story.publishedAt?.toISOString() || new Date().toISOString(),
      viewCount: story.viewCount,
      storyType: story.storyType,
    }));

    return NextResponse.json(formattedStories);
  } catch (error) {
    console.error("[RELATED_STORIES_ERROR]", error);
    return NextResponse.json([]);
  }
}