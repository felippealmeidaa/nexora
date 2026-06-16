import React from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Menu, ShieldCheck, Sun, Moon, Database, FileSpreadsheet } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { AnimatedBackground } from '../ui/AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { DataModeProvider, useDataMode } from '@/contexts/DataModeContext';
import { buildRolePath, getDefaultRoute, getInitials, getPageMeta, getRoleMeta } from '@/lib/app-shell';
import { BrandLogo } from '@/components/ui/BrandLogo';

function formatToday() {
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date());
}

function LayoutShell({ user, loading, authenticated }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { dataMode, setDataMode, canToggleDataMode } = useDataMode();
    const [sidebarOpen, setSidebarOpen] = React.useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth >= 1024;
    });
    const role = user?.role?.toLowerCase();
    const roleMeta = getRoleMeta(role);
    const pageMeta = getPageMeta(location.pathname, role, dataMode);

    const [theme, setTheme] = React.useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

    React.useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    React.useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    }, [location.pathname]);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        }
    }, [location.pathname, location.search]);

    const handleModeChange = React.useCallback((nextMode) => {
        if (dataMode === nextMode) {
            return;
        }
        setDataMode(nextMode);
        navigate(buildRolePath(role, 'dashboard'), { replace: false });
    }, [dataMode, navigate, role, setDataMode]);

    if (loading) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-primary">
                <AnimatedBackground variant="subtle" />
                <div className="relative z-10 flex flex-col items-center gap-5">
                    <div className="rounded-[28px] border border-white/80 bg-white/92 px-6 py-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.26)]">
                        <BrandLogo className="h-14" />
                    </div>
                    <div className="text-center">
                        <p className="mt-1 text-sm text-text-secondary">Preparando o ambiente acadêmico...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" replace />;
    }

    if (location.pathname === '/' && role && role !== 'viewer') {
        return <Navigate to={getDefaultRoute(role)} replace />;
    }

    return (
        <div className="min-h-screen overflow-x-hidden bg-bg-primary text-text-primary">
            <AnimatedBackground variant="subtle" />

            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-sm lg:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div className={`relative overflow-x-hidden transition-[padding] duration-300 ${sidebarOpen ? 'lg:pl-72' : 'lg:pl-0'}`}>
                <header className="relative z-30 border-b border-border-subtle bg-bg-primary/95 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.22)] lg:sticky lg:top-0 lg:bg-bg-primary/75 lg:shadow-none lg:backdrop-blur-xl">
                    <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4 lg:flex-1">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen((previous) => !previous)}
                                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-bg-card text-text-secondary shadow-sm transition-colors hover:border-border-hover hover:text-text-primary"
                                aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
                            >
                                <Menu className="h-5 w-5" />
                            </button>

                            <div className="min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
                                    {roleMeta.label}
                                </p>
                                <div className="mt-1 flex min-w-0 items-center gap-2.5 sm:gap-3">
                                    <pageMeta.icon className="h-[18px] w-[18px] flex-shrink-0 text-accent-blue" />
                                    <h2 className="truncate text-[1.05rem] font-semibold text-text-primary sm:text-lg">
                                        {pageMeta.label}
                                    </h2>
                                </div>
                                <p className="mt-1 hidden text-sm text-text-secondary sm:block">
                                    {pageMeta.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 lg:flex-nowrap lg:justify-end lg:self-start xl:self-center">
                            {canToggleDataMode ? (
                                <div className="hidden items-center gap-1 rounded-2xl border border-border-subtle bg-bg-card p-1 shadow-sm lg:inline-flex">
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange('real')}
                                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                            dataMode === 'real'
                                                ? 'bg-accent-blue text-white shadow-soft'
                                                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <Database className="h-3.5 w-3.5" />
                                        Dados em tempo real
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange('historical')}
                                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                            dataMode === 'historical'
                                                ? 'bg-accent-blue text-white shadow-soft'
                                                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5" />
                                        Dashboard de planilhas
                                    </button>
                                </div>
                            ) : null}

                            <button
                                type="button"
                                onClick={() => setTheme((previous) => previous === 'light' ? 'dark' : 'light')}
                                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle bg-bg-card text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary shadow-sm"
                                aria-label="Alternar tema"
                                title={theme === 'light' ? 'Ligar Modo Escuro' : 'Desativar Modo Escuro'}
                            >
                                {theme === 'light' ? (
                                    <Moon className="h-5 w-5 text-accent-purple" />
                                ) : (
                                    <Sun className="h-5 w-5 text-amber-400" />
                                )}
                            </button>

                            <div className="hidden items-center gap-3 rounded-2xl border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-secondary shadow-sm md:flex">
                                <CalendarDays className="h-4 w-4 text-accent-blue" />
                                {formatToday()}
                            </div>

                            <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-200/85 bg-white/98 px-3 py-2 shadow-[0_16px_34px_-26px_rgba(15,23,42,0.32)] sm:gap-3 dark:border-border-subtle dark:bg-bg-card">
                                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${roleMeta.accent} text-sm font-bold text-white shadow-[0_12px_28px_-18px_rgba(11,87,208,0.55)]`}>
                                    {getInitials(user?.full_name || user?.username)}
                                </div>
                                <div className="min-w-0 max-w-[170px] sm:max-w-[240px] lg:max-w-[300px]">
                                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-text-primary">
                                        {user?.full_name || user?.username}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-text-secondary">
                                        <ShieldCheck className="h-3.5 w-3.5 text-accent-blue" />
                                        {roleMeta.label}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>

                        {canToggleDataMode ? (
                            <div className="overflow-x-auto lg:hidden">
                                <div className="inline-flex min-w-full items-center gap-1 rounded-2xl border border-border-subtle bg-bg-card p-1 shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange('real')}
                                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                            dataMode === 'real'
                                                ? 'bg-accent-blue text-white shadow-soft'
                                                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <Database className="h-3.5 w-3.5" />
                                        Dados em tempo real
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleModeChange('historical')}
                                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                                            dataMode === 'historical'
                                                ? 'bg-accent-blue text-white shadow-soft'
                                                : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                                        }`}
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5" />
                                        Dashboard de planilhas
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </header>

                <main className="overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
                    <div className="mx-auto max-w-[1480px]">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export function Layout() {
    const { authenticated, loading, user } = useAuth();
    const role = user?.role?.toLowerCase();

    return (
        <DataModeProvider role={role}>
            <LayoutShell user={user} loading={loading} authenticated={authenticated} />
        </DataModeProvider>
    );
}
