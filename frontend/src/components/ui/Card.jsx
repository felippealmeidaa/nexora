import React from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export function Card({ children, className, variant = 'default', animate = true, delay = 0 }) {
    const variants = {
        default: 'glass-card',
        static: 'glass-card-static',
        glow: 'glass-card glow-border',
    };

    const Wrapper = animate ? motion.div : 'div';
    const animationProps = animate ? {
        initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] },
    } : {};

    return (
        <Wrapper
            className={clsx(
                variants[variant],
                'p-6 flex flex-col',
                className
            )}
            {...animationProps}
        >
            {children}
        </Wrapper>
    );
}

export function CardHeader({ title, subtitle, icon: Icon, className, action }) {
    return (
        <div className={clsx("flex items-center justify-between mb-5", className)}>
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="p-2 rounded-xl bg-accent-blue/10 text-accent-blue">
                        <Icon className="w-5 h-5" />
                    </div>
                )}
                <div>
                    <h3 className="text-base font-semibold text-gray-100">{title}</h3>
                    {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action && action}
        </div>
    );
}
