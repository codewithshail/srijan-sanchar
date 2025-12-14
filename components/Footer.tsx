"use client";

import Link from "next/link";
import { Facebook, Twitter, Instagram, Linkedin, Mail, MapPin, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const footerLinks = {
    Product: [
        { name: "Features", href: "#features" },
        { name: "Pricing", href: "#pricing" },
        { name: "How It Works", href: "#how-it-works" },
        { name: "FAQ", href: "#faq" },
    ],
    Company: [
        { name: "About Us", href: "/about" },
        { name: "Blog", href: "/blog" },
        { name: "Careers", href: "/careers" },
        { name: "Contact", href: "/contact" },
    ],
    Legal: [
        { name: "Privacy Policy", href: "/privacy" },
        { name: "Terms of Service", href: "/terms" },
        { name: "Cookie Policy", href: "/cookies" },
    ],
};

const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Instagram, href: "#", label: "Instagram" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
];

export default function Footer() {
    return (
        <footer className="bg-[#1A160F] text-white">
            {/* Newsletter Section */}
            <div className="border-b border-white/10">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
                    <div className="max-w-4xl mx-auto text-center">
                        <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4 text-white">
                            Stay Connected
                        </h3>
                        <p className="text-white/70 mb-6 max-w-xl mx-auto">
                            Get tips on preserving your family legacy and be the first to know about new features.
                        </p>
                        <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                            <Input
                                type="email"
                                placeholder="Enter your email"
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12 flex-1 focus:border-[#C9A86A] focus:ring-[#C9A86A]"
                            />
                            <Button className="h-12 px-6 bg-[#8B6F47] hover:bg-[#8B6F47]/90 text-white font-semibold">
                                Subscribe
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Main Footer Content */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-8 lg:gap-12">
                    {/* Brand Column */}
                    <div className="lg:col-span-4">
                        <Link href="/" className="inline-block mb-6">
                            <span className="text-3xl font-serif font-bold text-[#C9A86A]">
                                StoryWeave
                            </span>
                        </Link>
                        <p className="text-white/60 mb-8 leading-relaxed max-w-sm text-base">
                            Helping families preserve their legacy, one story at a time.
                            Secure, private, and forever yours.
                        </p>

                        {/* Social Links */}
                        <div className="flex gap-3">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-[#C9A86A]/30 hover:text-[#C9A86A] transition-all"
                                    aria-label={social.label}
                                >
                                    <social.icon className="w-5 h-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Links Columns */}
                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category} className="lg:col-span-2">
                            <h4 className="font-bold text-sm uppercase tracking-wider text-white mb-5">
                                {category}
                            </h4>
                            <ul className="space-y-3">
                                {links.map((link) => (
                                    <li key={link.name}>
                                        <Link
                                            href={link.href}
                                            className="text-white/60 hover:text-[#C9A86A] transition-colors text-sm"
                                        >
                                            {link.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Contact Column */}
                    <div className="lg:col-span-2">
                        <h4 className="font-bold text-sm uppercase tracking-wider text-white mb-5">
                            Contact
                        </h4>
                        <ul className="space-y-4">
                            <li className="flex items-start gap-3 text-sm text-white/60">
                                <Mail className="w-5 h-5 mt-0.5 shrink-0 text-[#C9A86A]" />
                                <span>hello@storyweave.com</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-white/60">
                                <Phone className="w-5 h-5 mt-0.5 shrink-0 text-[#C9A86A]" />
                                <span>+91 98765 43210</span>
                            </li>
                            <li className="flex items-start gap-3 text-sm text-white/60">
                                <MapPin className="w-5 h-5 mt-0.5 shrink-0 text-[#C9A86A]" />
                                <span>Mumbai, India</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-white/10 bg-[#120F0A]">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
                        <p className="text-white/60">
                            © {new Date().getFullYear()} StoryWeave Inc. All rights reserved.
                        </p>
                        <p className="flex items-center gap-2 text-white/60">
                            Made with <span className="text-red-500 text-lg">♥</span> in India
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
}
