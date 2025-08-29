import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { UserRole } from "./types";

export const getCurrentUser = async () => {
    const { userId } = await auth();
    if (!userId) return null;

    const user = await db.query.users.findFirst({
        where: eq(users.clerkId, userId),
    });

    return user;
};

export const checkRole = async (role: UserRole) => {
    const user = await getCurrentUser();

    if (!user || user.role !== role) {
        redirect("/");
    }
};

export const checkAdmin = async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        redirect("/");
    }
};

export const checkPsychiatristOrAdmin = async () => {
    const user = await getCurrentUser();
    if (!user || (user.role !== "psychiatrist" && user.role !== "admin")) {
        redirect("/");
    }
}