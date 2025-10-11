import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import StoryTypeSelection from "@/components/story-type-selection";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/sign-in");
  }
  
  // If user has already completed onboarding, redirect to dashboard
  if (user.hasCompletedOnboarding) {
    redirect("/dashboard");
  }

  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Welcome to StoryWeave! 🎉</h1>
        <p className="text-xl text-muted-foreground">
          Let's get started by creating your first story
        </p>
      </div>
      <StoryTypeSelection />
    </div>
  );
}
