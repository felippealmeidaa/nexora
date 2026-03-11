import React from 'react';
import clsx from 'clsx';
import { Loader2 } from 'lucide-react';

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    className,
    loading = false,
    icon: Icon,
    ...props
}) {
    const variants = {
        primary: "bg-gradient-to-r from-accent-blue to-accent-purple text-white shadow-glow-sm hover:shadow-glow hover:scale-[1.02] active:scale-[0.98]",
        secondary: "bg-bg-tertiary border border-border-subtle hover:border-border-hover hover:bg-bg-card-hover text-gray-200",
        danger: "bg-accent-rose/10 text-accent-rose border border-accent-rose/20 hover:bg-accent-rose/20 hover:shadow-glow-rose",
        ghost: "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white",
        outline: "bg-transparent border border-border-subtle text-gray-300 hover:border-accent-blue/40 hover:text-accent-blue-light hover:bg-accent-blue/5",
    };

    const sizes = {
        sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
        md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
        lg: 'px-6 py-3 text-base rounded-xl gap-2.5',
    };

    return (
        <button
            className={clsx(
                "inline-flex items-center justify-center font-medium transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100",
                variants[variant],
                sizes[size],
                className
            )}
            disabled={loading || props.disabled}
            {...props}
        >
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : Icon ? (
                <Icon className={clsx(size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
            ) : null}
            {children}
        </button>
    );
}
