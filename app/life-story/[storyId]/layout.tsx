import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LifeStoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
