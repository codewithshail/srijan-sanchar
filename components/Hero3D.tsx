"use client";

import { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, useGLTF, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Vintage Book Model Component
function VintageBookModel({ scale = 2, enableAutoRotate = true, ...props }: { scale?: number; rotation?: [number, number, number]; enableAutoRotate?: boolean }) {
    const group = useRef<THREE.Group>(null);
    const { scene } = useGLTF('/model/vintage_book_a301.glb');
    
    // Deep clone the scene with all materials to avoid texture sharing issues
    const clonedScene = useMemo(() => {
        const clone = scene.clone(true);
        clone.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                // Clone materials to avoid shared texture issues
                if (child.material) {
                    child.material = (child.material as THREE.Material).clone();
                }
            }
        });
        return clone;
    }, [scene]);

    useFrame((state) => {
        if (!enableAutoRotate) return;
        const t = state.clock.getElapsedTime();
        if (group.current) {
            group.current.position.y = Math.sin(t / 2) * 0.1;
        }
    });

    return (
        <group ref={group} scale={scale} {...props}>
            <primitive object={clonedScene} />
        </group>
    );
}

// Simple floating particles without instancing
function SimpleParticles() {
    const groupRef = useRef<THREE.Group>(null);
    
    const particles = useMemo(() => {
        return Array.from({ length: 20 }, (_, i) => ({
            position: [
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 4
            ] as [number, number, number],
            speed: 0.01 + Math.random() * 0.02,
            offset: Math.random() * Math.PI * 2,
        }));
    }, []);

    useFrame((state) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;
        
        groupRef.current.children.forEach((child, index) => {
            const p = particles[index];
            child.position.y += p.speed;
            if (child.position.y > 5) child.position.y = -4;
            
            const scale = 0.5 + Math.sin(t + p.offset) * 0.3;
            child.scale.setScalar(scale);
        });
    });

    return (
        <group ref={groupRef}>
            {particles.map((p, i) => (
                <mesh key={i} position={p.position}>
                    <sphereGeometry args={[0.05, 6, 6]} />
                    <meshBasicMaterial color="#C9A86A" transparent opacity={0.5} />
                </mesh>
            ))}
        </group>
    );
}

// Fallback UI when WebGL fails
function FallbackUI() {
    return (
        <div className="w-full h-[400px] sm:h-[450px] md:h-[550px] lg:h-[600px] flex items-center justify-center bg-gradient-to-br from-accent/20 via-primary/5 to-secondary/10 rounded-3xl overflow-hidden relative shadow-lg">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(139,111,71,0.08),transparent_70%)]" />
            <div className="relative z-10 p-6 text-center">
                <div className="w-24 h-32 bg-gradient-to-br from-primary/20 to-secondary/15 mx-auto rounded-lg mb-4 border-2 border-primary/20 flex items-center justify-center shadow-xl backdrop-blur-sm">
                    <span className="text-5xl drop-shadow-lg">📖</span>
                </div>
                <p className="text-base font-serif italic text-primary/90">Your story awaits...</p>
            </div>
        </div>
    );
}

// Loading UI
function LoadingUI() {
    return (
        <div className="w-full h-[400px] sm:h-[450px] md:h-[550px] lg:h-[600px] flex items-center justify-center bg-gradient-to-br from-accent/20 to-primary/10 rounded-3xl">
            <div className="text-center">
                <div className="w-24 h-32 mx-auto mb-4 bg-primary/20 rounded-lg animate-pulse" />
                <p className="text-muted-foreground">Loading experience...</p>
            </div>
        </div>
    );
}

export default function Hero3D() {
    const [mounted, setMounted] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check WebGL support
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (!gl) {
                setHasError(true);
            }
        } catch {
            setHasError(true);
        }
        setMounted(true);
    }, []);

    if (!mounted) {
        return <LoadingUI />;
    }

    if (hasError) {
        return <FallbackUI />;
    }

    return (
        <div className="w-full h-[400px] sm:h-[450px] md:h-[550px] lg:h-[600px] relative rounded-3xl overflow-hidden shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/15 via-background/50 to-primary/5 rounded-3xl" />
            
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent/20 to-primary/10 rounded-3xl z-20">
                    <div className="text-center">
                        <div className="w-24 h-32 mx-auto mb-4 bg-primary/20 rounded-lg animate-pulse" />
                        <p className="text-muted-foreground">Loading 3D experience...</p>
                    </div>
                </div>
            )}
            
            <Canvas
                dpr={1}
                gl={{ 
                    antialias: false,
                    alpha: true,
                    powerPreference: 'default',
                    stencil: false,
                    depth: true,
                }}
                style={{ background: 'transparent', cursor: 'grab' }}
                className="relative z-10"
                onCreated={() => setIsLoading(false)}
                onError={() => setHasError(true)}
                frameloop="always"
                flat
                camera={{ position: [0, 1, 8], fov: 45 }}
            >
                {/* OrbitControls for user interaction */}
                <OrbitControls 
                    enableZoom={false}
                    enablePan={false}
                    autoRotate
                    autoRotateSpeed={1}
                    minPolarAngle={Math.PI / 4}
                    maxPolarAngle={Math.PI / 1.5}
                />
                
                {/* Basic lighting - no environment map */}
                <ambientLight intensity={0.8} />
                <directionalLight position={[5, 5, 5]} intensity={1.2} color="#FFF8E7" />
                <directionalLight position={[-3, 3, 3]} intensity={0.6} color="#C9A86A" />

                <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
                    <VintageBookModel rotation={[0.3, 0, 0.05]} scale={2} enableAutoRotate={false} />
                </Float>

                <SimpleParticles />
            </Canvas>

            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-background/10 via-transparent to-background/5 rounded-3xl" />
            
            {/* Interaction hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/60 pointer-events-none">
                Drag to rotate
            </div>
        </div>
    );
}

// Preload the model
useGLTF.preload('/model/vintage_book_a301.glb');
