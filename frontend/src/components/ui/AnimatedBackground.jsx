import React from 'react';
import { motion } from 'framer-motion';

export function AnimatedBackground({ variant = 'default' }) {
    const orbs = variant === 'login' ? [
        { size: 500, x: '15%', y: '30%', color: 'rgba(99, 102, 241, 0.08)', duration: 20 },
        { size: 400, x: '75%', y: '20%', color: 'rgba(168, 85, 247, 0.06)', duration: 25 },
        { size: 350, x: '60%', y: '75%', color: 'rgba(34, 211, 238, 0.05)', duration: 22 },
        { size: 250, x: '30%', y: '80%', color: 'rgba(99, 102, 241, 0.04)', duration: 18 },
    ] : [
        { size: 400, x: '10%', y: '20%', color: 'rgba(99, 102, 241, 0.04)', duration: 25 },
        { size: 300, x: '85%', y: '60%', color: 'rgba(168, 85, 247, 0.03)', duration: 30 },
        { size: 250, x: '50%', y: '85%', color: 'rgba(34, 211, 238, 0.02)', duration: 28 },
    ];

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Grid pattern */}
            <div className="absolute inset-0 grid-pattern opacity-60" />

            {/* Floating orbs */}
            {orbs.map((orb, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: orb.size,
                        height: orb.size,
                        left: orb.x,
                        top: orb.y,
                        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                        filter: 'blur(40px)',
                    }}
                    animate={{
                        x: [0, 30, -20, 0],
                        y: [0, -25, 15, 0],
                        scale: [1, 1.1, 0.95, 1],
                    }}
                    transition={{
                        duration: orb.duration,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            ))}

            {/* Subtle vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-primary/80" />
        </div>
    );
}
