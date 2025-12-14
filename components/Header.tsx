"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, Globe, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
    { name: "Features", href: "#features" },
    { name: "How It Works", href: "#how-it-works" },
    { name: "Testimonials", href: "#testimonials" },
    { name: "Pricing", href: "#pricing" },
    { name: "FAQ", href: "#faq" },
];

const languages = [
    { code: "en", name: "English", nativeName: "English" },
    { code: "hi", name: "Hindi", nativeName: "हिंदी" },
];

export default function Header() {
    const pathname = usePathname();
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [currentLocale, setCurrentLocale] = useState("en");

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious() || 0;
        if (latest > previous && latest > 150) {
            setHidden(true);
        } else {
            setHidden(false);
        }
        setIsScrolled(latest > 50);
    });

    // Close mobile menu when resizing to desktop
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768 && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [mobileMenuOpen]);

    // Get current locale from pathname
    useEffect(() => {
        const pathLocale = pathname.split("/")[1];
        if (pathLocale === "hi" || pathLocale === "en") {
            setCurrentLocale(pathLocale);
        }
    }, [pathname]);

    const handleLanguageChange = (locale: string) => {
        setCurrentLocale(locale);
        // For now, just update the state. In a full implementation, you'd redirect to the localized route
        // router.push(`/${locale}${pathname}`);
    };

    return (
        <motion.header
            variants={{
                visible: { y: 0 },
                hidden: { y: "-100%" },
            }}
            animate={hidden ? "hidden" : "visible"}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-in-out",
                isScrolled ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border/40" : "bg-transparent"
            )}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 md:h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group">
                        <span className="text-2xl font-serif font-bold text-primary">StoryWeave</span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-6 lg:gap-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
                            >
                                {link.name}
                            </Link>
                        ))}
                    </nav>

                    {/* Actions */}
                    <div className="hidden md:flex items-center gap-4">
                        <ThemeToggle />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-primary cursor-pointer transition-colors">
                                    <Globe className="w-4 h-4" />
                                    <span>{currentLocale.toUpperCase()}</span>
                                    <ChevronDown className="w-3 h-3" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {languages.map((lang) => (
                                    <DropdownMenuItem
                                        key={lang.code}
                                        onClick={() => handleLanguageChange(lang.code)}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <span className="font-medium">{lang.nativeName}</span>
                                            <span className="text-sm text-muted-foreground ml-4">{lang.name}</span>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Link href="/sign-in">
                            <Button variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                                Log in
                            </Button>
                        </Link>
                        <Link href="/sign-up">
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all">
                                Start Your Story
                            </Button>
                        </Link>
                    </div>

                    {/* Mobile Menu Button - Only visible on mobile */}
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="flex md:hidden p-2 text-foreground hover:text-primary transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay - Only visible on mobile */}
            <AnimatePresence mode="wait">
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: "100%" }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed inset-0 z-50 bg-background flex flex-col md:hidden"
                    >
                        <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-border/40">
                            <span className="text-xl font-serif font-bold text-primary">StoryWeave</span>
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                className="p-2 text-foreground hover:text-primary transition-colors"
                                aria-label="Close menu"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto py-8 px-4 sm:px-6 flex flex-col">
                            <nav className="flex flex-col gap-6">
                                {navLinks.map((link, index) => (
                                    <motion.div
                                        key={link.name}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Link
                                            href={link.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="text-2xl font-serif font-medium text-foreground hover:text-primary transition-colors block"
                                        >
                                            {link.name}
                                        </Link>
                                    </motion.div>
                                ))}
                            </nav>

                            <div className="mt-auto pt-8 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="flex items-center gap-2 text-lg font-medium text-foreground/80 hover:text-primary transition-colors">
                                                <Globe className="w-5 h-5" />
                                                <span>{languages.find(l => l.code === currentLocale)?.nativeName}</span>
                                                <ChevronDown className="w-4 h-4" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-48">
                                            {languages.map((lang) => (
                                                <DropdownMenuItem
                                                    key={lang.code}
                                                    onClick={() => {
                                                        handleLanguageChange(lang.code);
                                                        setMobileMenuOpen(false);
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="font-medium">{lang.nativeName}</span>
                                                        <span className="text-sm text-muted-foreground">{lang.name}</span>
                                                    </div>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <ThemeToggle />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Link href="/sign-in" onClick={() => setMobileMenuOpen(false)}>
                                        <Button variant="outline" className="w-full h-12 text-base">
                                            Log in
                                        </Button>
                                    </Link>
                                    <Link href="/sign-up" onClick={() => setMobileMenuOpen(false)}>
                                        <Button className="w-full h-12 text-base bg-primary hover:bg-primary/90 text-primary-foreground">
                                            Start Your Story
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.header>
    );
}
