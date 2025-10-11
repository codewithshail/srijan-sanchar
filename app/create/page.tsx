import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import StoryTypeSelection from "@/components/story-type-selection";

export default async function CreateStoryPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // If user hasn't completed onboarding, redirect to onboarding
  if (!user.hasCompletedOnboarding) {
    redirect("/onboarding");
  }

  return <StoryTypeSelection />;
}