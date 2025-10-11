import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { appointments, stories } from "@/lib/db/schema";

export async function GET() {
  try {
    await checkPsychiatristOrAdmin();

    // Get total stories count
    const [totalStoriesResult] = await db
      .select({ count: count() })
      .from(stories)
      .where(eq(stories.status, "completed"));

    // Get pending appointments count
    const [pendingAppointmentsResult] = await db
      .select({ count: count() })
      .from(appointments)
      .where(eq(appointments.status, "pending"));

    // Get confirmed appointments count
    const [confirmedAppointmentsResult] = await db
      .select({ count: count() })
      .from(appointments)
      .where(eq(appointments.status, "confirmed"));

    // Get completed sessions count
    const [completedSessionsResult] = await db
      .select({ count: count() })
      .from(appointments)
      .where(eq(appointments.status, "completed"));

    const stats = {
      totalStories: totalStoriesResult.count,
      pendingAppointments: pendingAppointmentsResult.count,
      confirmedAppointments: confirmedAppointmentsResult.count,
      completedSessions: completedSessionsResult.count,
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("[PSY_DASHBOARD_STATS_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}