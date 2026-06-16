import React from 'react';
import { motion } from 'framer-motion';

export function AnimatedBackground({ variant = 'default' }) {
    const [isDark, setIsDark] = React.useState(() => {
        return document.documentElement.classList.contains('dark');
    });

    React.useEffect(() => {
        const updateTheme = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };

        const observer = new MutationObserver(updateTheme);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        updateTheme();

        return () => {
            observer.disconnect();
        };
    }, []);

    const orbs = isDark
        ? [
            { size: 600, x: '-10%', y: '-10%', color: 'rgba(11, 87, 208, 0.26)', duration: 25 },
            { size: 500, x: '70%', y: '5%', color: 'rgba(124, 58, 237, 0.22)', duration: 28 },
            { size: 450, x: '35%', y: '40%', color: 'rgba(106, 27, 255, 0.16)', duration: 32 },
            { size: 400, x: '60%', y: '70%', color: 'rgba(219, 39, 119, 0.12)', duration: 22 },
          ]
        : (variant === 'login' ? [
            { size: 520, x: '8%', y: '14%', color: 'rgba(11, 87, 208, 0.12)', duration: 22 },
            { size: 360, x: '72%', y: '12%', color: 'rgba(106, 27, 255, 0.12)', duration: 26 },
            { size: 420, x: '58%', y: '72%', color: 'rgba(0, 59, 143, 0.1)', duration: 24 },
            { size: 280, x: '22%', y: '78%', color: 'rgba(124, 58, 237, 0.1)', duration: 20 },
          ] : [
            { size: 420, x: '4%', y: '10%', color: 'rgba(11, 87, 208, 0.08)', duration: 28 },
            { size: 320, x: '74%', y: '18%', color: 'rgba(106, 27, 255, 0.08)', duration: 32 },
            { size: 260, x: '64%', y: '76%', color: 'rgba(0, 59, 143, 0.07)', duration: 30 },
          ]);

    return (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 grid-pattern opacity-70" />

            {orbs.map((orb, index) => (
                <motion.div
                    key={index}
                    className="absolute rounded-full"
                    style={{
                        width: orb.size,
                        height: orb.size,
                        left: orb.x,
                        top: orb.y,
                        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                        filter: 'blur(52px)',
                    }}
                    animate={{
                        x: [0, 32, -22, 0],
                        y: [0, -22, 16, 0],
                        scale: [1, 1.08, 0.96, 1],
                    }}
                    transition={{
                        duration: orb.duration,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            ))}

            {isDark ? (
                <>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,23,0.32),rgba(8,12,23,0))]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(11,87,208,0.12),transparent_65%)]" />
                </>
            ) : (
                <>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0))]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_54%)]" />
                </>
            )}
        </div>
    );
}
