"use client";

import dynamic from "next/dynamic";

const Hero3D = dynamic(() => import("./Hero3D"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[400px] sm:h-[450px] md:h-[550px] lg:h-[600px] flex items-center justify-center bg-gradient-to-br from-accent/20 to-primary/10 rounded-3xl animate-pulse">
            <div className="text-center">
                <div className="w-24 h-32 mx-auto mb-4 bg-primary/20 rounded-lg animate-pulse" />
                <p className="text-muted-foreground text-sm">Loading 3D Experience...</p>
            </div>
        </div>
    )
});

export default function Hero3DContainer() {
    return <Hero3D />;
}
