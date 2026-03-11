import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, PieChart, BrainCircuit, Lightbulb, Sparkles,
    LogOut, ChevronRight, GraduationCap, BookOpen, Shield, User, UserCircle,
    Database, Menu, X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import clsx from 'clsx';

// Itens de navegação por role
const NAV_BY_ROLE = {
    admin: [
        { icon: LayoutDashboard, label: 'Visão Geral', to: '/' },
        { icon: Users, label: 'Alunos', to: '/students' },
        { icon: PieChart, label: 'Análises', to: '/analytics' },
        { icon: BrainCircuit, label: 'Predições', to: '/predictions' },
        { icon: Lightbulb, label: 'Recomendações', to: '/recommendations' },
        { icon: Sparkles, label: 'Insights IA', to: '/ai-insights' },
    ],
    coordinator: [
        { icon: Shield, label: 'Painel do Coordenador', to: '/coordinator/dashboard' },
        { icon: Users, label: 'Alunos', to: '/students' },
        { icon: PieChart, label: 'Análises', to: '/analytics' },
        { icon: BrainCircuit, label: 'Predições', to: '/predictions' },
        { icon: Lightbulb, label: 'Recomendações', to: '/recommendations' },
        { icon: Sparkles, label: 'Insights IA', to: '/ai-insights' },
    ],
    professor: [
        { icon: LayoutDashboard, label: 'Visão Geral', to: '/' },
        { icon: Users, label: 'Alunos', to: '/students' },
        { icon: PieChart, label: 'Análises', to: '/analytics' },
        { icon: BrainCircuit, label: 'Predições', to: '/predictions' },
        { icon: Lightbulb, label: 'Recomendações', to: '/recommendations' },
        { icon: Sparkles, label: 'Insights IA', to: '/ai-insights' },
        { icon: Database, label: 'Dados Históricos', to: '/professor/historical-data' },
        { icon: GraduationCap, label: 'Minhas Disciplinas', to: '/professor/courses' },
        { icon: UserCircle, label: 'Meu Perfil', to: '/professor/profile' },
    ],
    student: [
        { icon: GraduationCap, label: 'Meu Painel', to: '/student/dashboard' },
        { icon: User, label: 'Meu Perfil', to: '/student/profile' },
    ],
    viewer: [
        { icon: LayoutDashboard, label: 'Visão Geral', to: '/' },
        { icon: Users, label: 'Alunos', to: '/students' },
        { icon: PieChart, label: 'Análises', to: '/analytics' },
    ],
};

export function Sidebar({ isCollapsed, onToggle }) {
    const { logout, user } = useAuth();
    const location = useLocation();

    const role = (user?.role || 'viewer').toLowerCase();
    const navItems = NAV_BY_ROLE[role] || NAV_BY_ROLE.viewer;

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    };

    const getRoleBadge = (role) => {
        const badges = {
            admin: { label: 'Admin', color: 'text-accent-rose' },
            coordinator: { label: 'Coordenador', color: 'text-accent-amber' },
            professor: { label: 'Professor', color: 'text-accent-purple' },
            student: { label: 'Aluno', color: 'text-accent-blue' },
            viewer: { label: 'Viewer', color: 'text-gray-400' },
        };
        return badges[role] || badges.viewer;
    };

    const badge = getRoleBadge(role);

    return (
        <motion.aside
            className="h-screen fixed left-0 top-0 flex flex-col z-50 bg-bg-secondary/80 backdrop-blur-2xl border-r border-border-subtle"
            animate={{ width: isCollapsed ? 80 : 288 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
            {/* Logo & Toggle */}
            <div className={clsx(
                "px-5 py-6 border-b border-border-subtle flex items-center gap-3 overflow-hidden",
                isCollapsed ? "flex-col justify-center" : "justify-between"
            )}>
                <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative flex-shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white font-bold text-lg shadow-glow-sm">
                            S
                        </div>
                        <div className="absolute -inset-1 rounded-xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 blur-md -z-10 animate-pulse-glow" />
                    </div>

                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="truncate"
                        >
                            <h1 className="font-bold text-lg tracking-tight gradient-text">
                                SIMA
                            </h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-medium">
                                Academic Intelligence
                            </p>
                        </motion.div>
                    )}
                </div>

                <button
                    onClick={onToggle}
                    className={clsx(
                        "p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors flex-shrink-0",
                        isCollapsed ? "mt-2" : ""
                    )}
                    title={isCollapsed ? "Expandir" : "Recolher"}
                >
                    <Menu className="w-5 h-5" />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
                {!isCollapsed && (
                    <p className="text-[10px] uppercase tracking-[0.15em] text-gray-600 font-semibold px-4 mb-3 truncate">
                        Menu Principal
                    </p>
                )}
                {navItems.map((item, index) => {
                    const isActive =
                        item.to === '/'
                            ? location.pathname === '/'
                            : location.pathname.startsWith(item.to);

                    return (
                        <motion.div
                            key={item.to}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 + 0.2, duration: 0.3 }}
                        >
                            <NavLink
                                to={item.to}
                                className={clsx(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group relative",
                                    isActive
                                        ? "text-white"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
                                )}
                                title={isCollapsed ? item.label : ""}
                            >
                                {/* Active background */}
                                {isActive && (
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-accent-blue/15 to-accent-purple/10 rounded-xl border border-accent-blue/15"
                                        layoutId="sidebar-active"
                                        transition={{
                                            type: 'spring',
                                            stiffness: 350,
                                            damping: 30,
                                        }}
                                    />
                                )}

                                <div className={clsx(
                                    "relative z-10 p-1.5 rounded-lg transition-colors duration-300 flex-shrink-0",
                                    isActive
                                        ? "text-accent-blue-light"
                                        : "text-gray-500 group-hover:text-gray-400"
                                )}>
                                    <item.icon className="w-[18px] h-[18px]" />
                                </div>

                                {!isCollapsed && (
                                    <motion.span
                                        className="relative z-10 flex-1 truncate"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                    >
                                        {item.label}
                                    </motion.span>
                                )}

                                {!isCollapsed && isActive && (
                                    <ChevronRight className="w-3.5 h-3.5 text-accent-blue-light/50 relative z-10 flex-shrink-0" />
                                )}
                            </NavLink>
                        </motion.div>
                    );
                })}
            </nav>

            {/* User Section */}
            <motion.div
                className="p-3 border-t border-border-subtle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
            >
                <div className={clsx(
                    "glass-card-static p-2 mb-3 flex items-center gap-3 overflow-hidden",
                    isCollapsed ? "justify-center" : ""
                )}>
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(user?.full_name || user?.username)}
                        </div>
                        {!isCollapsed && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-emerald rounded-full border-2 border-bg-secondary" />
                        )}
                    </div>

                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">
                                {user?.full_name || user?.username || 'Usuário'}
                            </p>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${badge.color}`}>
                                {badge.label}
                            </p>
                        </div>
                    )}
                </div>

                <button
                    onClick={logout}
                    className={clsx(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-accent-rose hover:bg-accent-rose/5 rounded-xl transition-all duration-300 group",
                        isCollapsed ? "justify-center" : ""
                    )}
                    title={isCollapsed ? "Sair do Sistema" : ""}
                >
                    <LogOut className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
                    {!isCollapsed && <span>Sair do Sistema</span>}
                </button>
            </motion.div>
        </motion.aside>
    );
}
