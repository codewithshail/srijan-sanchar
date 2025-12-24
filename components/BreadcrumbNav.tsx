"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Map path segments to human-readable labels
const pathLabels: Record<string, string> = {
    dashboard: "Dashboard",
    admin: "Admin",
    create: "Create Story",
    stories: "Stories",
    story: "Story",
    "life-story": "Life Story",
    "blog-editor": "Blog Editor",
    editor: "Editor",
    psychiatrist: "Expert Portal",
    analytics: "Analytics",
    orders: "Orders",
    publish: "Publish",
    wizard: "Wizard",
    contact: "Contact",
    explore: "Explore",
    onboarding: "Onboarding",
    public: "Public Stories",
    liked: "Liked Stories",
    moderation: "Moderation",
    jobs: "Jobs",
    "print-orders": "Print Orders",
    "sign-in": "Sign In",
    "sign-up": "Sign Up",
};

// Get label for a path segment
function getSegmentLabel(segment: string): string {
    // Check if it's a known path
    if (pathLabels[segment]) {
        return pathLabels[segment];
    }

    // If it looks like a UUID or ID, return "Details"
    if (segment.match(/^[a-f0-9-]{20,}$/i)) {
        return "Details";
    }

    // Otherwise, capitalize and replace hyphens with spaces
    return segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

export default function BreadcrumbNav() {
    const pathname = usePathname();

    // Don't show breadcrumbs on home page
    if (pathname === "/" || pathname === "") {
        return null;
    }

    // Split path into segments and filter empty strings
    const segments = pathname.split("/").filter(Boolean);

    // Don't show breadcrumbs if there are no segments
    if (segments.length === 0) {
        return null;
    }

    // Build breadcrumb items
    const breadcrumbItems = segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;
        const label = getSegmentLabel(segment);

        return {
            href,
            label,
            isLast,
        };
    });

    return (
        <div className="w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 overflow-x-auto">
                <Breadcrumb>
                    <BreadcrumbList className="flex-nowrap">
                        {/* Home link */}
                        <BreadcrumbItem className="shrink-0">
                            <BreadcrumbLink asChild>
                                <Link href="/" className="flex items-center gap-1.5">
                                    <Home className="h-4 w-4" />
                                    <span className="sr-only sm:not-sr-only">Home</span>
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>

                        {breadcrumbItems.map((item) => (
                            <div key={item.href} className="contents">
                                <BreadcrumbSeparator className="shrink-0" />
                                <BreadcrumbItem className="shrink-0">
                                    {item.isLast ? (
                                        <BreadcrumbPage className="max-w-[120px] sm:max-w-[200px] truncate">
                                            {item.label}
                                        </BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink asChild>
                                            <Link href={item.href} className="max-w-[100px] sm:max-w-[150px] truncate block">
                                                {item.label}
                                            </Link>
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                            </div>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
        </div>
    );
}
