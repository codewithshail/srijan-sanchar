import * as React from "react";
import { db } from "@/lib/db";
import { checkPsychiatristOrAdmin } from "@/lib/auth";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { google } from "googleapis";
import { Resend } from "resend";
import AppointmentConfirmationEmail from "@/components/emails/appointment-confirmation-email";
import { appointments } from "@/lib/schema";

// Ensure environment variables are set
if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Emails will not be sent.");
}
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.warn("Google Calendar credentials are not set. Meet links cannot be generated.");
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function PATCH(request: NextRequest, { params }: { params: { appointmentId: string } }) {
    try {
        await checkPsychiatristOrAdmin();
        const { appointmentId } = params;
        
        // 1. Fetch the appointment and the user associated with it
        const appointment = await db.query.appointments.findFirst({
            where: and(
                eq(appointments.id, appointmentId),
                eq(appointments.status, 'pending')
            ),
            with: {
                user: {
                    columns: { clerkId: true }
                }
            }
        });

        if (!appointment || !appointment.user) {
            return new NextResponse("Pending appointment not found", { status: 404 });
        }
        
        // 2. Get user's email from Clerk using their clerkId
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(appointment.user.clerkId);
        const userEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress;

        if (!userEmail) {
            throw new Error(`Could not find primary email for user ${appointment.user.clerkId}`);
        }
        
        // 3. Create Google Calendar event and get Meet link
        const auth = new google.auth.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Handle newline characters in env var
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });

        const calendar = google.calendar({ version: 'v3', auth });
        
        const appointmentTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
        const endTime = new Date(appointmentTime.getTime() + 30 * 60 * 1000); // 30 minute duration

        const event = await calendar.events.insert({
            calendarId: process.env.GOOGLE_CALENDAR_ID,
            conferenceDataVersion: 1,
            requestBody: {
                summary: 'StoryWeave Expert Session',
                description: 'A one-on-one session to discuss your story and path forward.',
                start: { dateTime: appointmentTime.toISOString(), timeZone: 'UTC' },
                end: { dateTime: endTime.toISOString(), timeZone: 'UTC' },
                attendees: [{ email: userEmail }],
                conferenceData: {
                    createRequest: {
                        requestId: `storyweave-${appointmentId}`,
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                }
            }
        });

        const googleMeetLink = event.data.hangoutLink;
        if (!googleMeetLink) {
            throw new Error("Failed to create Google Meet link.");
        }
        
        // 4. Update the appointment in our database with the link and status
        await db.update(appointments)
            .set({ 
                status: 'confirmed',
                googleMeetLink: googleMeetLink,
                appointmentTime: appointmentTime
            })
            .where(eq(appointments.id, appointmentId));
        
        // 5. Send confirmation email to the user via Resend
        // Use React.createElement to properly create the component
        const emailComponent = React.createElement(AppointmentConfirmationEmail, {
            userName: clerkUser.firstName || 'User',
            appointmentTime: appointmentTime,
            meetLink: googleMeetLink,
        });

        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: userEmail,
            subject: 'Your StoryWeave Session is Confirmed!',
            react: emailComponent
        });

        return NextResponse.json({ success: true, meetLink: googleMeetLink });

    } catch (error) {
        console.error("[APPOINTMENT_ACCEPT_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}