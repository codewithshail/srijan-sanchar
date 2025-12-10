import { db } from "@/lib/db";
import { stories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Metadata } from "next";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ storyId: string }>;
}

// Generate dynamic metadata for Open Graph tags
export async function generateMetadata({
  params,
}: {
  params: Promise<{ storyId: string }>;
}): Promise<Metadata> {
  const { storyId } = await params;

  try {
    // Fetch story data for metadata
    const storyData = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      with: {
        summary: true,
        owner: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!storyData) {
      return {
        title: "Story Not Found | StoryWeave",
        description: "The requested story could not be found.",
      };
    }

    // Build author name
    const owner = Array.isArray(storyData.owner)
      ? storyData.owner[0]
      : storyData.owner;
    const authorName =
      owner?.firstName && owner?.lastName
        ? `${owner.firstName} ${owner.lastName}`
        : owner?.firstName || "Anonymous";

    // Get story description
    const summary = Array.isArray(storyData.summary)
      ? storyData.summary[0]
      : storyData.summary;
    
    let description = "";
    if (storyData.storyType === "blog_story" && storyData.content) {
      // For blog stories, use first 160 chars of content
      const plainText = storyData.content.replace(/<[^>]*>/g, "").replace(/[#*_`]/g, "");
      description = plainText.slice(0, 160) + (plainText.length > 160 ? "..." : "");
    } else if (summary?.userSummary) {
      // For life stories, use summary
      const plainText = summary.userSummary.replace(/<[^>]*>/g, "").replace(/[#*_`]/g, "");
      description = plainText.slice(0, 160) + (plainText.length > 160 ? "..." : "");
    } else {
      description = `Read "${storyData.title || "Untitled Story"}" by ${authorName} on StoryWeave`;
    }

    const title = storyData.title || "Untitled Story";
    const storyTypeLabel = storyData.storyType === "life_story" ? "Life Story" : "Blog Story";
    
    // Get image URL for Open Graph
    const imageUrl = storyData.bannerImageUrl || storyData.thumbnailImageUrl;
    
    // Base URL for absolute URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://storyweave.app";
    const storyUrl = `${baseUrl}/story/${storyId}`;

    return {
      title: `${title} | ${storyTypeLabel} by ${authorName} | StoryWeave`,
      description,
      authors: [{ name: authorName }],
      openGraph: {
        title: `${title} | StoryWeave`,
        description,
        url: storyUrl,
        siteName: "StoryWeave",
        type: "article",
        publishedTime: storyData.publishedAt?.toISOString(),
        modifiedTime: storyData.updatedAt?.toISOString(),
        authors: [authorName],
        images: imageUrl
          ? [
              {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: title,
              },
            ]
          : [
              {
                url: `${baseUrl}/og-default.svg`,
                width: 1200,
                height: 630,
                alt: "StoryWeave - Share Your Story",
              },
            ],
      },
      twitter: {
        card: imageUrl ? "summary_large_image" : "summary",
        title: `${title} | StoryWeave`,
        description,
        images: imageUrl ? [imageUrl] : undefined,
        creator: `@${authorName.replace(/\s+/g, "")}`,
      },
      alternates: {
        canonical: storyUrl,
      },
      robots: {
        index: storyData.visibility !== "private",
        follow: storyData.visibility !== "private",
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Story | StoryWeave",
      description: "Read amazing stories on StoryWeave",
    };
  }
}

export default function StoryLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
