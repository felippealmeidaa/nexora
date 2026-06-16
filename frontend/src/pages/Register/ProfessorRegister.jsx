import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Lock, User } from 'lucide-react';

import api from '@/services/api';
import { AuthAlert, AuthBackButton, AuthCard, AuthLayout, AuthSuccessState } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ProfessorRegister() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [form, setForm] = useState({
        lyceum_login: '',
        lyceum_password: '',
        confirmPassword: '',
    });

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.lyceum_login.trim()) {
            setError('Informe o login do Lyceum.');
            return;
        }
        if (!form.lyceum_password || form.lyceum_password.length < 4) {
            setError('Informe a senha do Lyceum.');
            return;
        }
        if (form.lyceum_password !== form.confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        setStatusMessage('Validando credenciais e iniciando a leitura das turmas no Lyceum...');
        try {
            await api.post('/auth/register/professor', {
                lyceum_login: form.lyceum_login.trim(),
                lyceum_password: form.lyceum_password,
            });
            setSuccess(true);
        } catch (err) {
            const detail = err.response?.data?.detail;
            const message = Array.isArray(detail)
                ? detail.map((item) => item.msg).join(' | ')
                : detail;
            setError(
                message ||
                (err.request
                    ? 'Não foi possível conectar ao backend. Verifique se a API está rodando em http://127.0.0.1:8000.'
                    : 'Erro ao cadastrar professor.')
            );
        } finally {
            setLoading(false);
            setStatusMessage('');
        }
    };

    if (success) {
        return (
            <AuthSuccessState
                title="Conta de professor criada"
                description="As credenciais foram validadas no portal docente e os primeiros dados do Lyceum já foram preparados para a sua conta."
                onAction={() => navigate('/login')}
            />
        );
    }

    return (
        <AuthLayout>
            <AuthCard
                title="Cadastro de Professor"
                subtitle="Use exatamente o login e a senha do portal docente do Lyceum."
                icon={BookOpen}
                tone="professor"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}
                    {statusMessage ? (
                        <div className="rounded-[20px] border border-accent-blue/20 bg-accent-blue/6 px-4 py-3 text-sm text-accent-blue-dark">
                            {statusMessage}
                        </div>
                    ) : null}

                    <Input
                        label="Login do Lyceum"
                        placeholder="Matrícula, CPF ou e-mail usado no portal"
                        icon={User}
                        value={form.lyceum_login}
                        onChange={(event) => updateField('lyceum_login', event.target.value)}
                        required
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Senha do Lyceum"
                            type="password"
                            placeholder="Sua senha atual do portal"
                            icon={Lock}
                            value={form.lyceum_password}
                            onChange={(event) => updateField('lyceum_password', event.target.value)}
                            required
                        />
                        <Input
                            label="Confirmar senha"
                            type="password"
                            placeholder="Repita a senha"
                            icon={Lock}
                            value={form.confirmPassword}
                            onChange={(event) => updateField('confirmPassword', event.target.value)}
                            required
                        />
                    </div>

                    <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/45 p-5 text-sm leading-6 text-text-secondary">
                        A conta só é criada se o login no portal docente funcionar. Depois disso, o seu acesso na NEXORA continua usando esse mesmo login e senha, mas sem precisar autenticar no Lyceum antes de entrar.
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <AuthBackButton onClick={() => navigate('/register')} label="Voltar" />
                        <Button type="submit" loading={loading}>
                            Validar e criar conta
                        </Button>
                    </div>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
