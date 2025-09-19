import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { stories, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { PublicationWorkflow } from "@/components/publication-workflow";

interface PublishPageProps {
  params: Promise<{ storyId: string }>;
}

export default async function PublishPage({ params }: PublishPageProps) {
  const { storyId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  });

  if (!user) {
    redirect("/sign-in");
  }

  // Get story and verify ownership
  const story = await db.query.stories.findFirst({
    where: and(eq(stories.id, storyId), eq(stories.ownerId, user.id)),
  });

  if (!story) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicationWorkflow 
        storyId={storyId} 
        initialTitle={story.title || ""} 
      />
    </div>
  );
}