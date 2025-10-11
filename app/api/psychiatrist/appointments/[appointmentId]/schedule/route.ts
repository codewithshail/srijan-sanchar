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
    const { appointmentDate, notes } = await request.json();

    if (!appointmentDate) {
      return new NextResponse("Appointment date is required", { status: 400 });
    }

    const appointmentDateTime = new Date(appointmentDate);
    if (appointmentDateTime < new Date()) {
      return new NextResponse("Cannot schedule appointment in the past", { status: 400 });
    }

    const [updatedAppointment] = await db
      .update(appointments)
      .set({
        appointmentDate: appointmentDateTime,
        appointmentTime: appointmentDateTime, // Keep both for backward compatibility
        notes: notes || null,
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

    return NextResponse.json({ 
      success: true, 
      appointment: updatedAppointment 
    });
  } catch (error) {
    console.error("[APPOINTMENT_SCHEDULE_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}