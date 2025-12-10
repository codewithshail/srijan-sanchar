"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AnimatedThemeToggler } from "./magicui/animated-theme-toggler";
import { PsychiatristNotifications } from "./psychiatrist-notifications";
import { LanguageSwitcher } from "./language-switcher";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";


type User = {
  role: "user" | "psychiatrist" | "admin";
};

export default function SiteHeader() {
  const t = useTranslations("nav");
  
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
        <Link href="/" className="font-bold text-lg text-primary">
          StoryWeave
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <SignedOut>
            <nav className="hidden items-center gap-2 md:flex">
              <Link href="/stories/public">
                <Button variant="ghost" size="sm">{t("exploreStories")}</Button>
              </Link>
            </nav>
            <Link href="/sign-in">
              <Button size="sm">{t("signIn")}</Button>
            </Link>
          </SignedOut>
          
          <SignedIn>
            <nav className="hidden items-center gap-2 md:flex">
              <Link href="/stories/public">
                <Button variant="ghost" size="sm">{t("explore")}</Button>
              </Link>
              
              {/* Role-based navigation */}
              {user?.role === "admin" && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">{t("admin")}</Button>
                </Link>
              )}
              
              {user?.role === "psychiatrist" && (
                <Link href="/psychiatrist">
                  <Button variant="ghost" size="sm">{t("psychiatrist")}</Button>
                </Link>
              )}
              
              {/* User navigation */}
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">{t("dashboard")}</Button>
              </Link>
              
              <Link href="/create">
                <Button variant="default" size="sm">{t("newStory")}</Button>
              </Link>
            </nav>
            
            {user?.role === "psychiatrist" && <PsychiatristNotifications />}
            <UserButton />
          </SignedIn>
          <LanguageSwitcher />
          <AnimatedThemeToggler />
        </div>
      </div>
    </header>
  );
}