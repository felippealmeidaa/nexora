import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { AnimatedBackground } from '../ui/AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';
import clsx from 'clsx';

/**
 * Retorna a rota padrão de acordo com o papel do usuário.
 */
function getDefaultRoute(role) {
    switch (role) {
        case 'student':
            return '/student/dashboard';
        case 'professor':
            return '/professor/dashboard';
        case 'coordinator':
            return '/coordinator/dashboard';
        default:
            return '/'; // admin, viewer → dashboard padrão
    }
}

export function Layout() {
    const { authenticated, loading, user } = useAuth();
    const location = useLocation();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

    if (loading) {
        return (
            <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-4">
                <motion.div
                    className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white font-bold text-xl shadow-glow"
                    animate={{
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                >
                    S
                </motion.div>
                <motion.p
                    className="text-sm text-gray-500 font-medium"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    Carregando...
                </motion.p>
            </div>
        );
    }

    if (!authenticated) {
        return <Navigate to="/login" />;
    }

    // Redirecionar alunos que acessam "/" para seus dashboards
    const role = user?.role?.toLowerCase();
    if (location.pathname === '/' && (role === 'student' || role === 'coordinator')) {
        return <Navigate to={getDefaultRoute(role)} replace />;
    }

    return (
        <div className="min-h-screen bg-bg-primary text-gray-100 flex relative">
            <AnimatedBackground variant="subtle" />
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />
            <main
                className={clsx(
                    "flex-1 p-8 relative z-10 transition-all duration-300 ease-in-out",
                    isSidebarCollapsed ? "ml-20" : "ml-72"
                )}
            >
                <div className="max-w-7xl mx-auto">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={window.location.pathname}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                        >
                            <Outlet />
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
