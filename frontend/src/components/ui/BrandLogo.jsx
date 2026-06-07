import React from 'react';
import clsx from 'clsx';

export function BrandLogo({ className, compact = false, symbolOnly = false }) {
    return (
        <svg
            viewBox={symbolOnly ? "0 0 52 60" : "0 0 160 60"}
            className={clsx(
                'block w-auto',
                compact ? 'h-10' : 'h-12',
                className
            )}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="nGradient" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0B57D0" />
                    <stop offset="50%" stopColor="#6A1BFF" />
                    <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="1" x2="1" y2="0">
                    <stop offset="0%" stopColor="#3B82F6" />
                    <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
            </defs>
            
            {/* Símbolo do N Estatístico */}
            {/* Coluna da esquerda (barra de gráfico) */}
            <rect x="12" y="14" width="8" height="32" rx="3" fill="url(#nGradient)" />
            {/* Coluna da direita (barra de gráfico) */}
            <rect x="36" y="14" width="8" height="32" rx="3" fill="url(#nGradient)" />
            {/* Linha de tendência diagonal do N */}
            <path
                d="M16 38 L24 30 L32 26 L40 18"
                stroke="url(#lineGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* Pontos do gráfico de dispersão/tendência */}
            <circle cx="16" cy="38" r="3" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="24" cy="30" r="3" fill="#6A1BFF" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="32" cy="26" r="3" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx="40" cy="18" r="3" fill="#EC4899" stroke="#FFFFFF" strokeWidth="1" />

            {!symbolOnly && (
                <text
                    x="56"
                    y="38"
                    fill="currentColor"
                    fontFamily="'Manrope', 'Inter', sans-serif"
                    fontSize="22"
                    fontWeight="800"
                    letterSpacing="0.05em"
                    className="text-text-primary dark:text-gray-100"
                >
                    EXORA
                </text>
            )}
        </svg>
    );
}
