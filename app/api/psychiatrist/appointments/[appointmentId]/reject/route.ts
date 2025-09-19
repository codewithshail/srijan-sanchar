import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { appointments } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";

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

    const [rejectedAppointment] = await db
      .update(appointments)
      .set({
        status: "rejected",
        psychiatristId: psychiatrist.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(appointments.id, appointmentId),
          eq(appointments.status, "pending")
        )
      )
      .returning();

    if (!rejectedAppointment) {
      return new NextResponse("Pending appointment not found", { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[APPOINTMENT_REJECT_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
