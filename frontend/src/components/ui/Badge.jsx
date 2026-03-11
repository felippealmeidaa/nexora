import React from 'react';
import clsx from 'clsx';

const variantStyles = {
    success: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/20',
    warning: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
    danger: 'bg-accent-rose/10 text-accent-rose border-accent-rose/20',
    info: 'bg-accent-blue/10 text-accent-blue-light border-accent-blue/20',
    neutral: 'bg-white/5 text-gray-400 border-white/10',
    purple: 'bg-accent-purple/10 text-accent-purple-light border-accent-purple/20',
    cyan: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/20',
};

export function Badge({ children, variant = 'neutral', dot = false, className }) {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                variantStyles[variant],
                className
            )}
        >
            {dot && (
                <span className="relative flex h-2 w-2">
                    <span className={clsx(
                        'animate-ping absolute inline-flex h-full w-full rounded-full opacity-50',
                        variant === 'success' && 'bg-accent-emerald',
                        variant === 'warning' && 'bg-accent-amber',
                        variant === 'danger' && 'bg-accent-rose',
                        variant === 'info' && 'bg-accent-blue',
                        variant === 'neutral' && 'bg-gray-400',
                    )} />
                    <span className={clsx(
                        'relative inline-flex rounded-full h-2 w-2',
                        variant === 'success' && 'bg-accent-emerald',
                        variant === 'warning' && 'bg-accent-amber',
                        variant === 'danger' && 'bg-accent-rose',
                        variant === 'info' && 'bg-accent-blue',
                        variant === 'neutral' && 'bg-gray-400',
                    )} />
                </span>
            )}
            {children}
        </span>
    );
}
