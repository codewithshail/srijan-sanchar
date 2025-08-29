import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { AnimatedThemeToggler } from "./magicui/animated-theme-toggler";


export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-bold text-lg">
          StoryWeave
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="hidden items-center gap-2 md:flex">
            <Link href="/stories/public">
                <Button variant="ghost" size="sm">Explore Stories</Button>
            </Link>
          </nav>
          <SignedIn>
            <Link href="/dashboard">
                <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
           <SignedOut>
            <Link href="/sign-in">
                <Button size="sm">Sign In</Button>
            </Link>
          </SignedOut>
          <AnimatedThemeToggler />
        </div>
      </div>
    </header>
  );
}