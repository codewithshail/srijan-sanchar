import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentFlags, users, stories, comments } from "@/lib/db/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { isUserAdmin } from "@/lib/auth";

/**
 * GET /api/admin/moderation
 * Get all flagged content for admin review
 */
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const contentType = searchParams.get('contentType');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(contentFlags.status, status as any)];
    if (contentType && ['story', 'comment'].includes(contentType)) {
      conditions.push(eq(contentFlags.contentType, contentType as any));
    }

    // Get flags with pagination
    const flags = await db.query.contentFlags.findMany({
      where: and(...conditions),
      orderBy: [desc(contentFlags.createdAt)],
      limit,
      offset,
      with: {
        reporter: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        moderator: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Enrich flags with content details
    const enrichedFlags = await Promise.all(
      flags.map(async (flag) => {
        let content = null;
        let contentOwner = null;

        if (flag.contentType === 'story') {
          const story = await db.query.stories.findFirst({
            where: eq(stories.id, flag.contentId),
            with: {
              owner: {
                columns: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });
          if (story) {
            content = {
              id: story.id,
              title: story.title,
              preview: story.content?.substring(0, 200) || '',
              status: story.status,
            };
            contentOwner = story.owner;
          }
        } else {
          const comment = await db.query.comments.findFirst({
            where: eq(comments.id, flag.contentId),
            with: {
              user: {
                columns: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });
          if (comment) {
            content = {
              id: comment.id,
              preview: comment.content.substring(0, 200),
            };
            contentOwner = comment.user;
          }
        }

        return {
          ...flag,
          content,
          contentOwner,
        };
      })
    );

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(contentFlags)
      .where(and(...conditions));

    return NextResponse.json({
      flags: enrichedFlags,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[ADMIN_MODERATION_GET_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
