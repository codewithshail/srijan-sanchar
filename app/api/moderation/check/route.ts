import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { contentModerationService, type ModerationResult } from "@/lib/moderation";

/**
 * POST /api/moderation/check
 * Check content for moderation issues
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { content, contentType } = body as {
      content: string;
      contentType: 'story' | 'comment';
    };

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (!contentType || !['story', 'comment'].includes(contentType)) {
      return NextResponse.json(
        { error: "Valid contentType is required (story or comment)" },
        { status: 400 }
      );
    }

    const result: ModerationResult = await contentModerationService.moderateContent(
      content,
      contentType
    );

    return NextResponse.json({
      ...result,
      shouldAutoRemove: contentModerationService.shouldAutoRemove(result),
    });
  } catch (error) {
    console.error("[MODERATION_CHECK_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
