import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, PanelLeftClose, X } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

import { useAuth } from '@/contexts/AuthContext';
import { useDataMode } from '@/contexts/DataModeContext';
import { getInitials, getNavItems, getRoleMeta } from '@/lib/app-shell';
import { BrandLogo } from '@/components/ui/BrandLogo';

export function Sidebar({ open, onClose }) {
    const { logout, user } = useAuth();
    const { dataMode } = useDataMode();
    const location = useLocation();
    const roleMeta = getRoleMeta(user?.role);
    const navItems = getNavItems(user?.role, dataMode);
    const userName = user?.full_name || user?.username || 'Usuário';

    const handleNavClick = () => {
        if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            onClose();
        }
    };

    return (
        <motion.aside
            className={clsx(
                'fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[292px] flex-col overflow-hidden border-r border-slate-200/85 bg-white shadow-[0_28px_80px_-44px_rgba(15,23,42,0.24)] transition-transform duration-300 dark:border-border-subtle dark:bg-bg-card dark:shadow-[0_28px_80px_-44px_rgba(0,0,0,0.45)]',
                open ? 'translate-x-0' : '-translate-x-full',
            )}
            initial={false}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,255,0.96))] dark:bg-[linear-gradient(180deg,rgba(13,19,33,0.98),rgba(8,12,23,0.92))]" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent-blue/20 to-transparent" />

            <div className="relative flex items-center justify-between border-b border-slate-200/80 bg-white px-5 py-4 dark:border-border-subtle dark:bg-bg-card sm:px-6 sm:py-5">
                <Link
                    to={roleMeta.home}
                    className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80"
                >
                    <BrandLogo symbolOnly className="h-11 flex-shrink-0 sm:h-12" compact />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-text-tertiary">
                            Plataforma acadêmica
                        </p>
                        <h1 className="mt-1 text-[1.72rem] font-bold tracking-[-0.03em] text-slate-950 dark:text-text-primary sm:text-[1.85rem]">
                            NEXORA
                        </h1>
                    </div>
                </Link>

                <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary dark:border-border-subtle dark:bg-bg-secondary dark:hover:border-border-hover lg:hidden"
                    aria-label="Fechar menu"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="relative flex-1 overflow-y-auto bg-white px-4 py-4 dark:bg-bg-card">
                <nav className="rounded-[28px] border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(240,246,255,0.84))] p-3 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.24)] dark:border-border-subtle dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.92),rgba(13,19,33,0.88))] dark:shadow-[0_18px_40px_-34px_rgba(0,0,0,0.42)]">
                    <div className="flex items-center justify-between px-2 pb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-text-tertiary">
                            Navegação
                        </p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-bg-secondary dark:text-text-tertiary">
                            {navItems.length} módulos
                        </span>
                    </div>

                    <div className="space-y-2.5">
                        {navItems.map((item) => {
                            const active = item.to === '/'
                                ? location.pathname === '/'
                                : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                            const navState = item.to?.includes('analysis-center')
                                ? { openAnalysisIntro: true }
                                : undefined;

                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    state={navState}
                                    onClick={handleNavClick}
                                    className={clsx(
                                        'group relative block overflow-hidden rounded-[16px] border px-3.5 py-3 transition-all duration-200',
                                        active
                                            ? 'border-accent-blue/25 bg-[linear-gradient(135deg,rgba(11,87,208,0.2),rgba(106,27,255,0.14))] shadow-[0_20px_38px_-28px_rgba(11,87,208,0.62)] dark:border-accent-blue/35 dark:bg-[linear-gradient(135deg,rgba(11,87,208,0.28),rgba(106,27,255,0.18))] dark:shadow-[0_20px_38px_-28px_rgba(11,87,208,0.45)]'
                                            : 'border-slate-200/70 bg-white/88 hover:border-accent-blue/16 hover:bg-slate-50 dark:border-border-subtle dark:bg-bg-secondary/55 dark:hover:border-accent-blue/25 dark:hover:bg-bg-secondary',
                                    )}
                                >
                                    <span
                                        className={clsx(
                                            'absolute inset-y-3.5 left-0 w-1 rounded-r-full transition-all duration-200',
                                            active ? 'bg-gradient-to-b from-accent-blue to-accent-purple opacity-100' : 'bg-accent-blue/25 opacity-0 group-hover:opacity-100',
                                        )}
                                    />

                                    <div className="flex items-center gap-3">
                                        <div
                                            className={clsx(
                                                'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border transition-colors',
                                                active
                                                    ? 'border-white/80 bg-white text-accent-blue shadow-sm dark:border-accent-blue/20 dark:bg-bg-card dark:text-accent-blue'
                                                    : 'border-slate-200/70 bg-slate-50 text-text-secondary group-hover:border-accent-blue/12 group-hover:text-accent-blue dark:border-border-subtle dark:bg-bg-tertiary dark:group-hover:border-accent-blue/25',
                                            )}
                                        >
                                            <item.icon className="h-[18px] w-[18px]" />
                                        </div>

                                        <div className="min-w-0">
                                            <p
                                                className={clsx(
                                                    'text-sm font-semibold leading-5',
                                                    active ? 'text-slate-950 dark:text-text-primary' : 'text-slate-700 group-hover:text-text-primary dark:text-text-secondary dark:group-hover:text-text-primary',
                                                )}
                                            >
                                                {item.label}
                                            </p>
                                            {active ? (
                                                <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-600 dark:text-text-tertiary">
                                                    {item.description}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </NavLink>
                            );
                        })}
                    </div>
                </nav>
            </div>

            <div className="relative border-t border-border-subtle bg-white p-3 transition-colors dark:bg-bg-card sm:p-4">
                <div className="rounded-[24px] border border-slate-200/85 bg-white p-3.5 transition-all dark:border-border-subtle dark:bg-bg-secondary/70">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-gradient-to-br ${roleMeta.accent} text-sm font-bold text-white shadow-[0_16px_32px_-20px_rgba(11,87,208,0.75)]`}>
                            {getInitials(userName)}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-text-primary">{userName}</p>
                            <p className="text-xs text-slate-600 dark:text-text-secondary">{roleMeta.label}</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={logout}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-bg-card px-4 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:border-danger/15 hover:bg-danger/5 hover:text-danger dark:bg-bg-tertiary dark:hover:bg-danger/10"
                    >
                        <LogOut className="h-4 w-4" />
                        Encerrar sessão
                    </button>
                </div>

                <div className="mt-3 hidden items-center gap-2 px-2 text-[11px] leading-5 text-text-tertiary sm:flex">
                    <PanelLeftClose className="h-3.5 w-3.5" />
                    Sistema institucional de monitoramento e predição acadêmica
                </div>
            </div>
        </motion.aside>
    );
}
