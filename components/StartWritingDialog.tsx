"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PenTool, BookOpen, ArrowRight } from "lucide-react";

interface StartWritingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function StartWritingDialog({ open, onOpenChange }: StartWritingDialogProps) {
    const router = useRouter();
    const [isNavigating, setIsNavigating] = useState(false);

    const handleChoice = (destination: "dashboard" | "stories") => {
        setIsNavigating(true);
        onOpenChange(false);

        if (destination === "dashboard") {
            router.push("/sign-up");
        } else {
            router.push("/stories/public");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-2xl font-serif">
                        Where would you like to go?
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Choose your destination to continue
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start gap-2 hover:border-primary hover:bg-primary/5"
                        onClick={() => handleChoice("dashboard")}
                        disabled={isNavigating}
                    >
                        <div className="flex items-center gap-3 w-full">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <PenTool className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-semibold">Start Writing</div>
                                <div className="text-sm text-muted-foreground">
                                    Create your own story in the dashboard
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </Button>

                    <Button
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-start gap-2 hover:border-primary hover:bg-primary/5"
                        onClick={() => handleChoice("stories")}
                        disabled={isNavigating}
                    >
                        <div className="flex items-center gap-3 w-full">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <BookOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-semibold">Explore Stories</div>
                                <div className="text-sm text-muted-foreground">
                                    Browse stories from the community
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default StartWritingDialog;
