import { db } from "@/lib/db";
import { appointments, stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const userAppointments = await db.query.appointments.findMany({
      where: eq(appointments.userId, user.id),
      with: {
        story: {
          columns: {
            title: true,
          },
        },
      },
      orderBy: (appointments, { desc }) => [desc(appointments.createdAt)],
    });

    return NextResponse.json(userAppointments);
  } catch (error) {
    console.error("[USER_APPOINTMENTS_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}