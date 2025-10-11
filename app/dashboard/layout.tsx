import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // If user hasn't completed onboarding, redirect to onboarding
  if (!user.hasCompletedOnboarding) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
