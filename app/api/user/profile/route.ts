import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
    });
  } catch (error) {
    console.error("[USER_PROFILE_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}