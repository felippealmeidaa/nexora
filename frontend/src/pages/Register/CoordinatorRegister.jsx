import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, Lock, Shield } from 'lucide-react';

import api from '@/services/api';
import { AuthAlert, AuthBackButton, AuthCard, AuthLayout, AuthSuccessState } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { digitsOnly } from '@/lib/formValidation';

export function CoordinatorRegister() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        registration_code: '',
        password: '',
        confirmPassword: '',
    });

    const updateField = (field, value) => {
        setForm((previous) => ({ ...previous, [field]: value }));
        setError('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (!form.registration_code || form.registration_code.length < 5) {
            setError('Informe o código aprovado do coordenador.');
            return;
        }
        if (!form.password || form.password.length < 6) {
            setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/register/coordinator', {
                registration_code: form.registration_code,
                password: form.password,
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
                    : 'Erro ao cadastrar coordenador.')
            );
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <AuthSuccessState
                title="Conta de coordenador criada"
                description="Seu código foi validado na lista aprovada pelo admin e a senha escolhida já está ativa para o login."
                onAction={() => navigate('/login')}
            />
        );
    }

    return (
        <AuthLayout>
            <AuthCard
                title="Cadastro de Coordenador"
                subtitle="Use o código previamente aprovado pelo admin e defina sua senha de acesso."
                icon={Shield}
                tone="coordinator"
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error ? <AuthAlert>{error}</AuthAlert> : null}

                    <Input
                        label="Código aprovado"
                        placeholder="Ex: 10001"
                        icon={Hash}
                        value={form.registration_code}
                        onChange={(event) => updateField('registration_code', digitsOnly(event.target.value, 20))}
                        required
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            label="Senha"
                            type="password"
                            placeholder="Mínimo de 6 caracteres"
                            icon={Lock}
                            value={form.password}
                            onChange={(event) => updateField('password', event.target.value)}
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
                        O código do coordenador precisa ter sido criado previamente no módulo de coordenadores da conta admin. Depois do cadastro, o login na NEXORA passa a ser feito com o código e a senha que você escolheu aqui.
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2">
                        <AuthBackButton onClick={() => navigate('/register')} label="Voltar" />
                        <Button type="submit" loading={loading}>
                            Criar conta
                        </Button>
                    </div>
                </form>
            </AuthCard>
        </AuthLayout>
    );
}
