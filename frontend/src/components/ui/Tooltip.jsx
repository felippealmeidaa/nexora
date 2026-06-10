import React, { useState } from 'react';
import clsx from 'clsx';

export function Tooltip({ content, children, align = 'center', position = 'top' }) {
    const [active, setActive] = useState(false);

    let alignmentClasses = '';
    if (position === 'top') {
        alignmentClasses = clsx(
            'bottom-full mb-2.5',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'start' && 'left-0',
            align === 'end' && 'right-0'
        );
    } else if (position === 'bottom') {
        alignmentClasses = clsx(
            'top-full mt-2.5',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'start' && 'left-0',
            align === 'end' && 'right-0'
        );
    }

    return (
        <div 
            className="relative inline-block"
            onMouseEnter={() => setActive(true)}
            onMouseLeave={() => setActive(false)}
        >
            {children}
            <div 
                className={clsx(
                    "absolute z-[9999] w-64 p-3.5 text-xs text-white bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-[0_15px_35px_rgba(0,0,0,0.45)] pointer-events-none transition-all duration-200 ease-out transform origin-bottom",
                    alignmentClasses,
                    active ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1.5"
                )}
            >
                <div className="space-y-2 text-left leading-relaxed">
                    {content}
                </div>
            </div>
        </div>
    );
}
