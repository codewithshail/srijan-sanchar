import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { appointments } from "@/lib/db/schema";

export async function GET() {
  try {
    await checkPsychiatristOrAdmin();

    const confirmedAppointments = await db.query.appointments.findMany({
      where: or(
        eq(appointments.status, "confirmed"),
        eq(appointments.status, "completed")
      ),
      with: {
        user: {
          columns: {
            clerkId: true,
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        story: {
          columns: {
            title: true,
          },
        },
      },
      orderBy: (appointments, { desc }) => [desc(appointments.appointmentTime)],
    });

    return NextResponse.json(confirmedAppointments);
  } catch (error) {
    console.error("[PSY_GET_CONFIRMED_APPOINTMENTS_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}