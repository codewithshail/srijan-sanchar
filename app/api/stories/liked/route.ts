import { db } from "@/lib/db";
import { likes, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq, desc } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

// GET - Get all stories liked by the current user
export async function GET(_req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { id: true },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Get all liked stories with their details
    const likedStories = await db.query.likes.findMany({
      where: eq(likes.userId, user.id),
      orderBy: [desc(likes.createdAt)],
      with: {
        story: {
          columns: {
            id: true,
            title: true,
            storyType: true,
            status: true,
            visibility: true,
            thumbnailImageUrl: true,
            bannerImageUrl: true,
            publishedAt: true,
            viewCount: true,
            listenCount: true,
            content: true,
          },
          with: {
            owner: {
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            summary: {
              columns: {
                userSummary: true,
              },
            },
          },
        },
      },
    });

    // Transform the data to a cleaner format
    const formattedStories = likedStories
      .filter((like) => {
        const story = like.story as any;
        return story && story.status === "published";
      })
      .map((like) => {
        const story = like.story as any;
        const owner = Array.isArray(story.owner) ? story.owner[0] : story.owner;
        const summary = Array.isArray(story.summary) ? story.summary[0] : story.summary;
        
        // Get snippet from content or summary
        let summarySnippet = "";
        if (story.storyType === "blog_story" && story.content) {
          // Strip HTML tags and get first 150 chars
          summarySnippet = story.content.replace(/<[^>]*>/g, "").substring(0, 150) + "...";
        } else if (summary?.userSummary) {
          summarySnippet = summary.userSummary.substring(0, 150) + "...";
        }

        return {
          id: story.id,
          title: story.title || "Untitled Story",
          storyType: story.storyType,
          summarySnippet,
          visibility: story.visibility,
          authorName: owner
            ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || "Anonymous"
            : "Anonymous",
          publishedAt: story.publishedAt,
          viewCount: story.viewCount,
          listenCount: story.listenCount,
          thumbnailImageUrl: story.thumbnailImageUrl,
          bannerImageUrl: story.bannerImageUrl,
          likedAt: like.createdAt,
        };
      });

    return NextResponse.json(formattedStories);
  } catch (error) {
    console.error("[LIKED_STORIES_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
