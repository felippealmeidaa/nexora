import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';
import { User, Lock, AlertCircle, ArrowRight, Clock, ArrowLeft } from 'lucide-react';

export function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(identifier, password);

        if (result.success) {
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
        } else {
            // Detectar se é conta pendente de aprovação
            if (result.message && result.message.includes('aprovad')) {
                setPendingApproval(true);
            } else {
                setError(result.message);
            }
            setLoading(false);
        }
    };

    // Tela de aguardando aprovação
    if (pendingApproval) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
                <AnimatedBackground variant="login" />
                <motion.div
                    className="w-full max-w-md relative z-10 px-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="glass-card p-10 border-border-subtle text-center">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                        >
                            <Clock className="w-20 h-20 text-accent-amber mx-auto" />
                        </motion.div>
                        <h2 className="text-2xl font-bold mt-6 text-text-primary">Aguardando Aprovação</h2>
                        <p className="text-text-secondary mt-3">
                            Sua solicitação de cadastro foi recebida e está aguardando aprovação de um administrador.
                            Você receberá acesso assim que for aprovado.
                        </p>
                        <div className="mt-4 p-3 rounded-xl bg-accent-amber/8 border border-accent-amber/20">
                            <p className="text-sm text-accent-amber font-medium">
                                ⏳ Sua conta está pendente de aprovação
                            </p>
                        </div>
                        <button
                            onClick={() => setPendingApproval(false)}
                            className="mt-8 w-full py-3 text-sm text-gray-500 hover:text-accent-blue transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Voltar para o login
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }
    return (
        <div className="min-h-screen flex items-center justify-center bg-bg-primary relative overflow-hidden">
            <AnimatedBackground variant="login" />

            <motion.div
                className="w-full max-w-md relative z-10"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
                <div className="glass-card p-10 border-border-subtle">
                    {/* Logo */}
                    <motion.div
                        className="text-center mb-10"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <div className="relative inline-block">
                            <motion.div
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white font-bold text-2xl shadow-glow mx-auto"
                                animate={{ rotate: [0, 2, -2, 0] }}
                                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                S
                            </motion.div>
                            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-accent-blue/15 to-accent-purple/15 blur-xl -z-10 animate-pulse-glow" />
                        </div>

                        <h1 className="text-3xl font-bold mt-6 gradient-text">SIMA</h1>
                        <p className="text-gray-500 mt-2 text-sm tracking-wide">
                            Sistema Inteligente de Monitoramento Acadêmico
                        </p>
                    </motion.div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {error && (
                            <motion.div
                                className="bg-accent-rose/8 border border-accent-rose/20 text-accent-rose text-sm p-3.5 rounded-xl flex items-center gap-2.5"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: [0, -4, 4, -4, 4, 0] }}
                                transition={{ x: { duration: 0.4 }, opacity: { duration: 0.3 } }}
                            >
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="font-medium">{error}</span>
                            </motion.div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.4 }}
                        >
                            <Input
                                label="E-mail, Matrícula ou Código"
                                placeholder="Digite seu e-mail, matrícula ou código"
                                icon={User}
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4, duration: 0.4 }}
                        >
                            <Input
                                label="Senha"
                                type="password"
                                placeholder="••••••••"
                                icon={Lock}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5, duration: 0.4 }}
                        >
                            <Button type="submit" loading={loading} className="mt-3 w-full py-3" icon={ArrowRight}>
                                Entrar no Sistema
                            </Button>
                        </motion.div>
                    </form>

                    {/* Register Link */}
                    <motion.div
                        className="text-center mt-6"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        <p className="text-sm text-gray-500">
                            Não tem conta?{' '}
                            <button
                                type="button"
                                onClick={() => navigate('/register')}
                                className="text-accent-blue hover:text-accent-blue-light font-medium transition-colors cursor-pointer"
                            >
                                Cadastre-se
                            </button>
                        </p>
                    </motion.div>

                    {/* Footer */}
                    <motion.p
                        className="text-center text-[11px] text-gray-600 mt-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                    >
                        Plataforma de análise preditiva acadêmica
                    </motion.p>
                </div>
            </motion.div>
        </div>
    );
}
