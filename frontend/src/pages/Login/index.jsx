import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, ShieldAlert, Timer } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
    AuthAlert,
    AuthCard,
    AuthLayout,
    AuthSuccessState,
} from '@/components/auth/AuthLayout';

// Número máximo de tentativas antes de bloquear o botão no frontend
const MAX_CLIENT_ATTEMPTS = 5;
// Tempo de bloqueio local em segundos (espelha o backend: 15 min)
const LOCKOUT_SECONDS = 15 * 60;

export function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    const [rateLimited, setRateLimited] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Iniciar countdown quando bloqueado
    useEffect(() => {
        if (!rateLimited) return;
        setCountdown(LOCKOUT_SECONDS);
        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setRateLimited(false);
                    setAttempts(0);
                    setError('');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [rateLimited]);

    const formatCountdown = useCallback((seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(identifier, password);
        if (result.success) {
            const from = location.state?.from?.pathname || '/';
            navigate(from, { replace: true });
            return;
        }

        if (result.rateLimited) {
            setRateLimited(true);
            setLoading(false);
            return;
        }

        if (result.message && result.message.includes('aprovad')) {
            setPendingApproval(true);
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            setError(result.message);
        }
        setLoading(false);
    };

    if (pendingApproval) {
        return (
            <AuthSuccessState
                status="pending"
                title="Cadastro em aprovação"
                description="Sua solicitação foi registrada e está aguardando validação administrativa para liberar o acesso."
                actionLabel="Voltar para o login"
                onAction={() => setPendingApproval(false)}
            />
        );
    }

    // Estado de bloqueio por rate limit
    if (rateLimited) {
        return (
            <AuthLayout>
                <AuthCard
                    title="Acesso temporariamente bloqueado"
                    subtitle="Muitas tentativas de login incorretas foram detectadas."
                    maxWidth="max-w-md"
                >
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-danger/10 ring-4 ring-danger/20">
                            <ShieldAlert className="h-10 w-10 text-danger" />
                        </div>

                        <div className="text-center">
                            <p className="text-sm text-text-secondary">
                                Por segurança, o acesso foi bloqueado temporariamente.
                                Aguarde o tempo abaixo para tentar novamente.
                            </p>
                        </div>

                        {countdown > 0 && (
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2 rounded-2xl border border-warning/20 bg-warning/8 px-6 py-4">
                                    <Timer className="h-5 w-5 text-warning" />
                                    <span className="text-2xl font-bold tabular-nums text-warning">
                                        {formatCountdown(countdown)}
                                    </span>
                                </div>
                                <p className="text-xs text-text-tertiary">Tempo restante</p>
                            </div>
                        )}

                        <p className="text-center text-xs text-text-tertiary">
                            Se você acredita que houve um erro, entre em contato com o administrador da instituição.
                        </p>
                    </div>
                </AuthCard>
            </AuthLayout>
        );
    }

    const isLockedOut = attempts >= MAX_CLIENT_ATTEMPTS;

    return (
        <AuthLayout>
            <AuthCard
                title="Entrar na NEXORA"
                subtitle="Use sua matrícula, código institucional ou e-mail para acessar a plataforma."
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    {isLockedOut && !rateLimited ? (
                        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-3 text-center text-xs text-danger">
                            <ShieldAlert className="mx-auto mb-1 h-4 w-4" />
                            Limite de tentativas atingido. O próximo erro irá bloquear o acesso por 15 minutos.
                        </div>
                    ) : null}

                    {attempts > 0 && !isLockedOut ? (
                        <p className="text-center text-xs text-warning">
                            {MAX_CLIENT_ATTEMPTS - attempts} tentativa{MAX_CLIENT_ATTEMPTS - attempts !== 1 ? 's' : ''} restante{MAX_CLIENT_ATTEMPTS - attempts !== 1 ? 's' : ''} antes do bloqueio temporário.
                        </p>
                    ) : null}

                    <Input
                        label="E-mail, matrícula ou código"
                        placeholder="Digite seu identificador de acesso"
                        icon={User}
                        value={identifier}
                        onChange={(event) => setIdentifier(event.target.value)}
                        required
                        disabled={isLockedOut || loading}
                    />

                    <Input
                        label="Senha"
                        type="password"
                        placeholder="Digite sua senha"
                        icon={Lock}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        disabled={isLockedOut || loading}
                    />

                    <Button
                        type="submit"
                        loading={loading}
                        disabled={isLockedOut}
                        className="w-full"
                    >
                        Entrar no sistema
                    </Button>
                </form>

                <div className="mt-7 text-center">
                    <p className="text-sm text-text-secondary">
                        Não tem conta?{' '}
                        <button
                            type="button"
                            onClick={() => navigate('/register')}
                            className="font-semibold text-accent-blue transition-colors hover:text-accent-purple"
                        >
                            Solicitar cadastro
                        </button>
                    </p>
                </div>

                <p className="mt-5 text-center text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                    NEXORA | inteligência analítica para decisões acadêmicas
                </p>
            </AuthCard>
        </AuthLayout>
    );
}
