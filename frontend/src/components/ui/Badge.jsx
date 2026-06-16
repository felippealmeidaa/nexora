import React from 'react';
import clsx from 'clsx';

const variantStyles = {
    success: 'bg-success/10 text-success border-success/15 dark:bg-emerald-950/35 dark:text-emerald-300 dark:border-emerald-900/40',
    warning: 'bg-warning/10 text-warning border-warning/15 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-900/40',
    attention: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/35 dark:text-amber-300 dark:border-amber-900/40',
    danger: 'bg-danger/10 text-danger border-danger/15 dark:bg-red-950/35 dark:text-red-300 dark:border-red-900/40',
    info: 'bg-accent-blue/10 text-accent-blue border-accent-blue/15 dark:bg-blue-950/35 dark:text-blue-300 dark:border-blue-900/40',
    neutral: 'bg-slate-200/55 text-text-secondary border-slate-300/60 dark:bg-slate-800/40 dark:text-text-secondary dark:border-slate-700/50',
    purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/15 dark:bg-purple-950/35 dark:text-purple-300 dark:border-purple-900/40',
    cyan: 'bg-accent-cyan/12 text-accent-blue border-accent-cyan/20 dark:bg-cyan-950/35 dark:text-cyan-300 dark:border-cyan-900/40',
};

export function Badge({
    children,
    variant = 'neutral',
    dot = false,
    className,
    ...props
}) {
    return (
        <span
            className={clsx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
                variantStyles[variant],
                className,
            )}
            {...props}
        >
            {dot && (
                <span className={clsx(
                    'h-2 w-2 rounded-full',
                    variant === 'success' && 'bg-success',
                    variant === 'warning' && 'bg-warning',
                    variant === 'attention' && 'bg-amber-500',
                    variant === 'danger' && 'bg-danger',
                    variant === 'info' && 'bg-accent-blue',
                    variant === 'purple' && 'bg-accent-purple',
                    variant === 'cyan' && 'bg-accent-cyan',
                    variant === 'neutral' && 'bg-text-tertiary',
                )} />
            )}
            {children}
        </span>
    );
}
