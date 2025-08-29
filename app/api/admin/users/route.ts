import { db } from "@/lib/db";
// import { users } from "@/lib/db/schema";
import { checkAdmin } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        await checkAdmin(); // Protect the route
        const allUsers = await db.query.users.findMany({
            columns: { id: true, clerkId: true, role: true, createdAt: true },
            orderBy: (t, { desc }) => [desc(t.createdAt)],
        });
        return NextResponse.json(allUsers);
    } catch (error) {
        // The checkAdmin function redirects, so this catch is for other errors
        console.error("[ADMIN_GET_USERS_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}