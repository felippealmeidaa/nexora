import React from 'react';
import clsx from 'clsx';

export function Input({ label, icon: Icon, error, className, ...props }) {
    return (
        <div className={clsx("flex flex-col gap-2", className)}>
            {label && (
                <label className="text-sm font-medium text-gray-400 tracking-wide">
                    {label}
                </label>
            )}
            <div className="relative group">
                {Icon && (
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-accent-blue transition-colors duration-300">
                        <Icon className="w-4 h-4" />
                    </div>
                )}
                <input
                    className={clsx(
                        "w-full bg-bg-secondary/80 border border-border-subtle rounded-xl px-4 py-3 text-sm text-gray-100",
                        "focus:outline-none focus:border-accent-blue/50 focus:ring-2 focus:ring-accent-blue/10 focus:bg-bg-secondary",
                        "transition-all duration-300 placeholder:text-gray-600",
                        "hover:border-border-hover",
                        Icon && "pl-11",
                        error && "border-accent-rose/50 focus:border-accent-rose focus:ring-accent-rose/10"
                    )}
                    {...props}
                />
                {/* Glow line on focus */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-gradient-to-r from-accent-blue to-accent-purple rounded-full transition-all duration-500 group-focus-within:w-[calc(100%-24px)]" />
            </div>
            {error && <span className="text-xs text-accent-rose font-medium">{error}</span>}
        </div>
    );
}
