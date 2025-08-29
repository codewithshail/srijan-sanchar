import { db } from "@/lib/db";
import { appointments, stories, users } from "@/lib/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const appointmentSchema = z.object({
    storyId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) return new NextResponse("Unauthorized", { status: 401 });

        const user = await db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
        if (!user) return new NextResponse("User not found", { status: 404 });

        const body = await request.json();
        const parsed = appointmentSchema.safeParse(body);
        if (!parsed.success) {
            return new NextResponse("Invalid request body", { status: 400 });
        }
        const { storyId } = parsed.data;
            
        // Ensure the user owns the story
        const story = await db.query.stories.findFirst({
            where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
        });
        if (!story) {
            return new NextResponse("Story not found or not owned by user", { status: 403 });
        }
        
        // Check if an appointment already exists
        const existingAppointment = await db.query.appointments.findFirst({
            where: eq(appointments.storyId, storyId),
        });

        if (existingAppointment) {
            return NextResponse.json({ message: "An appointment request already exists for this story." }, { status: 409 });
        }

        const [newAppointment] = await db.insert(appointments).values({
            storyId,
            userId: user.id,
        }).returning();

        return NextResponse.json(newAppointment, { status: 201 });

    } catch (error) {
        console.error("[APPOINTMENT_CREATE_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}