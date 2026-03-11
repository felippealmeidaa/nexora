/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                bg: {
                    primary: '#050816',
                    secondary: '#0a0f1e',
                    tertiary: '#111a2e',
                    card: 'rgba(10, 15, 30, 0.7)',
                    'card-hover': 'rgba(15, 22, 40, 0.8)',
                },
                accent: {
                    blue: '#6366f1',
                    'blue-light': '#818cf8',
                    purple: '#a855f7',
                    'purple-light': '#c084fc',
                    emerald: '#34d399',
                    amber: '#fbbf24',
                    rose: '#fb7185',
                    cyan: '#22d3ee',
                    indigo: '#6366f1',
                },
                border: {
                    subtle: 'rgba(255, 255, 255, 0.06)',
                    hover: 'rgba(255, 255, 255, 0.12)',
                    glow: 'rgba(99, 102, 241, 0.3)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            backdropBlur: {
                xs: '2px',
                '2xl': '40px',
            },
            boxShadow: {
                'glow-sm': '0 0 15px -3px rgba(99, 102, 241, 0.15)',
                'glow': '0 0 30px -5px rgba(99, 102, 241, 0.2)',
                'glow-lg': '0 0 60px -10px rgba(99, 102, 241, 0.25)',
                'glow-purple': '0 0 30px -5px rgba(168, 85, 247, 0.2)',
                'glow-emerald': '0 0 30px -5px rgba(52, 211, 153, 0.2)',
                'glow-rose': '0 0 30px -5px rgba(251, 113, 133, 0.2)',
                'glow-amber': '0 0 30px -5px rgba(251, 191, 36, 0.2)',
                'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
                'card': '0 4px 24px -1px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                'card-hover': '0 8px 40px -4px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.15)',
            },
            animation: {
                'float': 'float 8s ease-in-out infinite',
                'float-delayed': 'float 8s ease-in-out infinite 4s',
                'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
                'gradient-shift': 'gradient-shift 8s ease infinite',
                'slide-up': 'slide-up 0.5s ease-out',
                'fade-in': 'fade-in 0.6s ease-out',
                'spin-slow': 'spin 12s linear infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '33%': { transform: 'translateY(-12px) rotate(1deg)' },
                    '66%': { transform: 'translateY(6px) rotate(-1deg)' },
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: '0.4' },
                    '50%': { opacity: '0.8' },
                },
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'slide-up': {
                    from: { opacity: '0', transform: 'translateY(16px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
