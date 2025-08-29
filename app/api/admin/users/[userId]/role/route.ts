import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/lib/types";

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
    try {
        const { userId } = await context.params;
        const adminUser = await getCurrentUser();
        if (!adminUser || adminUser.role !== 'admin') {
             return new NextResponse("Forbidden", { status: 403 });
        }
        
        const { role } = (await request.json()) as { role: UserRole };
        if (!["user", "psychiatrist", "admin"].includes(role)) {
            return new NextResponse("Invalid role", { status: 400 });
        }
        
        // Prevent an admin from demoting themselves
        if (adminUser.id === userId && role !== 'admin') {
            return new NextResponse("Cannot change your own role.", { status: 400 });
        }

        const [updatedUser] = await db.update(users)
            .set({ role })
            .where(eq(users.id, userId))
            .returning();
            
        if (!updatedUser) {
            return new NextResponse("User not found", { status: 404 });
        }

        return NextResponse.json(updatedUser);
    } catch (error) {
        console.error("[ADMIN_UPDATE_ROLE_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}