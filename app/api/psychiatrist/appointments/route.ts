import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { appointments } from "@/lib/schema";

export async function GET() {
    try {
        await checkPsychiatristOrAdmin();
        
        const appointmentRequests = await db.query.appointments.findMany({
            where: eq(appointments.status, 'pending'),
            with: {
                user: {
                    columns: {
                        clerkId: true, // For identification, can be email later
                        id: true,
                    }
                },
                story: {
                    columns: {
                        title: true,
                    }
                }
            },
            orderBy: (appointments, { asc }) => [asc(appointments.createdAt)],
        });

        return NextResponse.json(appointmentRequests);
    } catch (error) {
        console.error("[PSY_GET_APPOINTMENTS_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}