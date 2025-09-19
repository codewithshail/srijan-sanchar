import * as React from "react";
import { db } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { clerkClient, type EmailAddress } from "@clerk/nextjs/server";
import { google } from "googleapis";
import { Resend } from "resend";
import AppointmentConfirmationEmail from "@/components/emails/appointment-confirmation-email";
import { appointments, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";

if (!process.env.RESEND_API_KEY) console.warn("RESEND_API_KEY is not set.");
if (
  !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !process.env.GOOGLE_PRIVATE_KEY
)
  console.warn("Google Calendar credentials are not set.");

const resend = new Resend(process.env.RESEND_API_KEY);

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

    const appointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, appointmentId),
        eq(appointments.status, "pending")
      ),
      with: { user: { columns: { clerkId: true } } },
    });

    if (!appointment || !appointment.user) {
      return new NextResponse("Pending appointment not found", { status: 404 });
    }

    // Fix 1: Properly await clerkClient before accessing properties
    const clerkUser = await (await clerkClient()).users.getUser(appointment.user.clerkId);
    
    // Fix 2: Add proper type annotation for the find parameter
    const userEmail = clerkUser.emailAddresses.find(
      (e: EmailAddress) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!userEmail)
      throw new Error(
        `Could not find primary email for user ${appointment.user.clerkId}`
      );

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });

    const appointmentTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endTime = new Date(appointmentTime.getTime() + 30 * 60 * 1000);

    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      conferenceDataVersion: 1,
      requestBody: {
        summary: "StoryWeave Expert Session",
        description:
          "A one-on-one session to discuss your story and path forward.",
        start: { dateTime: appointmentTime.toISOString(), timeZone: "UTC" },
        end: { dateTime: endTime.toISOString(), timeZone: "UTC" },
        attendees: [{ email: userEmail }],
        conferenceData: {
          createRequest: {
            requestId: `storyweave-${appointmentId}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const googleMeetLink = event.data.hangoutLink;
    if (!googleMeetLink) throw new Error("Failed to create Google Meet link.");

    await db
      .update(appointments)
      .set({
        status: "confirmed",
        googleMeetLink: googleMeetLink,
        appointmentTime: appointmentTime,
        psychiatristId: psychiatrist.id,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    const emailComponent = React.createElement(AppointmentConfirmationEmail, {
      userName: clerkUser.firstName || "User",
      appointmentTime: appointmentTime,
      meetLink: googleMeetLink,
    });

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: userEmail,
      subject: "Your StoryWeave Session is Confirmed!",
      react: emailComponent,
    });

    return NextResponse.json({ success: true, meetLink: googleMeetLink });
  } catch (error) {
    console.error("[APPOINTMENT_ACCEPT_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}