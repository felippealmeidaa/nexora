import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, ShieldAlert, Timer, User } from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthAlert, AuthCard, AuthLayout } from '@/components/auth/AuthLayout';

const MAX_CLIENT_ATTEMPTS = 10;
const LOCKOUT_SECONDS = 60;

export function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [rateLimited, setRateLimited] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [countdown, setCountdown] = useState(0);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        if (!rateLimited) return;
        setCountdown(LOCKOUT_SECONDS);
        const interval = setInterval(() => {
            setCountdown((previous) => {
                if (previous <= 1) {
                    clearInterval(interval);
                    setRateLimited(false);
                    setAttempts(0);
                    setError('');
                    return 0;
                }
                return previous - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [rateLimited]);

    const formatCountdown = useCallback((seconds) => {
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${remainingSeconds}`;
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

        setAttempts((previous) => previous + 1);
        setError(result.message);
        setLoading(false);
    };

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

                        {countdown > 0 ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2 rounded-2xl border border-warning/20 bg-warning/8 px-6 py-4">
                                    <Timer className="h-5 w-5 text-warning" />
                                    <span className="text-2xl font-bold tabular-nums text-warning">
                                        {formatCountdown(countdown)}
                                    </span>
                                </div>
                                <p className="text-xs text-text-tertiary">Tempo restante</p>
                            </div>
                        ) : null}
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
                subtitle="Use seu login do Lyceum, código aprovado ou e-mail cadastrado para acessar a plataforma."
                maxWidth="max-w-md"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    {isLockedOut ? (
                        <div className="rounded-2xl border border-danger/20 bg-danger/5 p-3 text-center text-xs text-danger">
                            <ShieldAlert className="mx-auto mb-1 h-4 w-4" />
                            Limite de tentativas atingido. O próximo erro irá bloquear o acesso por 1 minuto.
                        </div>
                    ) : null}

                    {attempts > 0 && !isLockedOut ? (
                        <p className="text-center text-xs text-warning">
                            {MAX_CLIENT_ATTEMPTS - attempts} tentativa{MAX_CLIENT_ATTEMPTS - attempts !== 1 ? 's' : ''} restante{MAX_CLIENT_ATTEMPTS - attempts !== 1 ? 's' : ''} antes do bloqueio temporário.
                        </p>
                    ) : null}

                    <Input
                        label="Login, código ou e-mail"
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

                    <Button type="submit" className="w-full" loading={loading} disabled={isLockedOut}>
                        Entrar
                    </Button>

                    <div className="text-center text-sm text-text-secondary">
                        Ainda não tem conta?{' '}
                        <button
                            type="button"
                            onClick={() => navigate('/register')}
                            className="font-semibold text-accent-blue transition-colors hover:text-accent-purple"
                        >
                            Criar conta
                        </button>
                    </div>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
