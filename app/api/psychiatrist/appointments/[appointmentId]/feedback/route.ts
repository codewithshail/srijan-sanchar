import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { appointments } from "@/lib/db/schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const psychiatrist = await getCurrentUser();
    if (
      !psychiatrist ||
      (psychiatrist.role !== "psychiatrist" && psychiatrist.role !== "admin")
    ) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { appointmentId } = await params;
    const { feedback, notes, status } = await request.json();

    const [updatedAppointment] = await db
      .update(appointments)
      .set({
        psychiatristFeedback: feedback,
        notes: notes,
        status: status || "completed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.psychiatristId, psychiatrist.id)
        )
      )
      .returning();

    if (!updatedAppointment) {
      return new NextResponse("Appointment not found or not authorized", { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[APPOINTMENT_FEEDBACK_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}