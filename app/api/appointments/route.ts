import { db } from "@/lib/db";
import { appointments, stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });
    const { storyId } = await request.json();
    if (!storyId) return new NextResponse("Story ID required", { status: 400 });

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
    });
    if (!story) return new NextResponse("Story not found", { status: 404 });

    const existing = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.storyId, storyId),
        eq(appointments.userId, user.id),
        eq(appointments.status, "pending")
      ),
    });
    if (existing)
      return new NextResponse("Appointment already pending", { status: 409 });

    const [created] = await db
      .insert(appointments)
      .values({ storyId, userId: user.id, status: "pending" })
      .returning();
    return NextResponse.json({ id: created.id });
  } catch {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
