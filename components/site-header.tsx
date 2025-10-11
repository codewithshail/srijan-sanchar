"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AnimatedThemeToggler } from "./magicui/animated-theme-toggler";
import { PsychiatristNotifications } from "./psychiatrist-notifications";
import { useQuery } from "@tanstack/react-query";

type User = {
  role: "user" | "psychiatrist" | "admin";
};

export default function SiteHeader() {
  const { data: user } = useQuery<User>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) return null;
      return res.json();
    },
    retry: false,
  });

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-bold text-lg">
          StoryWeave
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <SignedOut>
            <nav className="hidden items-center gap-2 md:flex">
              <Link href="/stories/public">
                <Button variant="ghost" size="sm">Explore Stories</Button>
              </Link>
            </nav>
            <Link href="/sign-in">
              <Button size="sm">Sign In</Button>
            </Link>
          </SignedOut>
          
          <SignedIn>
            <nav className="hidden items-center gap-2 md:flex">
              <Link href="/stories/public">
                <Button variant="ghost" size="sm">Explore</Button>
              </Link>
              
              {/* Role-based navigation */}
              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">Admin</Button>
                </Link>
              )}
              
              {user?.role === "psychiatrist" && (
                <Link href="/psychiatrist">
                  <Button variant="ghost" size="sm">Psychiatrist</Button>
                </Link>
              )}
              
              {/* User navigation */}
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              
              <Link href="/create">
                <Button variant="default" size="sm">+ New Story</Button>
              </Link>
            </nav>
            
            {user?.role === "psychiatrist" && <PsychiatristNotifications />}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <AnimatedThemeToggler />
        </div>
      </div>
    </header>
  );
}