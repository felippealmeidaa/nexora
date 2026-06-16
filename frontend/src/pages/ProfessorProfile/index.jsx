import React, { useEffect, useState } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck, UserCircle } from 'lucide-react';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const INITIAL_LYCEUM_FORM = {
    lyceum_password: '',
    confirm_lyceum_password: '',
};

const INITIAL_SYSTEM_FORM = {
    current_password: '',
    new_password: '',
    confirm_new_password: '',
};

function getRoleLabel(role) {
    if (role === 'admin') return 'Admin';
    if (role === 'coordinator') return 'Coordenador';
    return 'Professor';
}

export function ProfessorProfile() {
    const { user } = useAuth();
    const supportsLyceumSync = user?.role === 'professor';
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [profile, setProfile] = useState(null);
    const [liveCatalog, setLiveCatalog] = useState(null);
    const [lyceumForm, setLyceumForm] = useState(INITIAL_LYCEUM_FORM);
    const [systemForm, setSystemForm] = useState(INITIAL_SYSTEM_FORM);
    const [lyceumSaving, setLyceumSaving] = useState(false);
    const [systemSaving, setSystemSaving] = useState(false);
    const [lyceumError, setLyceumError] = useState('');
    const [lyceumSuccess, setLyceumSuccess] = useState('');
    const [systemError, setSystemError] = useState('');
    const [systemSuccess, setSystemSuccess] = useState('');

    useEffect(() => {
        async function fetchProfile() {
            setLoading(true);
            setPageError('');
            try {
                const [profileResponse, catalogResponse] = await Promise.allSettled([
                    api.get('/professors/me'),
                    api.get('/live-data/catalog'),
                ]);

                if (profileResponse.status === 'fulfilled') {
                    setProfile(profileResponse.value.data);
                }

                if (catalogResponse.status === 'fulfilled') {
                    setLiveCatalog(catalogResponse.value.data);
                }
            } catch (err) {
                console.error('Erro ao carregar perfil', err);
                setPageError('Não foi possível carregar o perfil.');
            } finally {
                setLoading(false);
            }
        }

        fetchProfile();
    }, []);

    const updateLyceumField = (field, value) => {
        setLyceumForm((previous) => ({ ...previous, [field]: value }));
        setLyceumError('');
        setLyceumSuccess('');
    };

    const updateSystemField = (field, value) => {
        setSystemForm((previous) => ({ ...previous, [field]: value }));
        setSystemError('');
        setSystemSuccess('');
    };

    const handleLyceumPasswordSubmit = async (event) => {
        event.preventDefault();
        setLyceumSaving(true);
        setLyceumError('');
        setLyceumSuccess('');

        try {
            await api.post('/auth/me/lyceum-password', {
                lyceum_password: lyceumForm.lyceum_password,
                confirm_lyceum_password: lyceumForm.confirm_lyceum_password,
            });
            setLyceumSuccess('Senha do Lyceum validada e atualizada para as próximas sincronizações.');
            setLyceumForm(INITIAL_LYCEUM_FORM);
        } catch (err) {
            console.error('Erro ao atualizar senha do Lyceum', err);
            setLyceumError(err.response?.data?.detail || 'Não foi possível validar a senha do Lyceum.');
        } finally {
            setLyceumSaving(false);
        }
    };

    const handleSystemPasswordSubmit = async (event) => {
        event.preventDefault();
        setSystemSaving(true);
        setSystemError('');
        setSystemSuccess('');

        try {
            await api.post('/auth/me/system-password', {
                current_password: systemForm.current_password,
                new_password: systemForm.new_password,
                confirm_new_password: systemForm.confirm_new_password,
            });
            setSystemSuccess('Senha da NEXORA atualizada com sucesso.');
            setSystemForm(INITIAL_SYSTEM_FORM);
        } catch (err) {
            console.error('Erro ao atualizar senha da NEXORA', err);
            setSystemError(err.response?.data?.detail || 'Não foi possível atualizar a senha da NEXORA.');
        } finally {
            setSystemSaving(false);
        }
    };

    const classesCount = (liveCatalog?.courses || []).reduce((sum, item) => sum + (item.classes_count || 0), 0);
    const studentsCount = (liveCatalog?.courses || []).reduce((sum, item) => sum + (item.students_count || 0), 0);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-purple border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {pageError ? (
                <div className="rounded-[22px] border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                    {pageError}
                </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader
                            title="Identidade da conta"
                            icon={UserCircle}
                        />
                        <div className="grid gap-4 md:grid-cols-2">
                            <ReadOnlyField label="Nome completo" value={profile?.full_name || user?.full_name || '-'} />
                            <ReadOnlyField label="Usuário de acesso" value={user?.username || '-'} />
                            <ReadOnlyField label="Perfil" value={getRoleLabel(user?.role)} />
                            <ReadOnlyField
                                label="Fonte dos cursos"
                                value={(liveCatalog?.courses || []).length > 0 ? 'Scraper docente do Lyceum' : 'Aguardando sincronização'}
                            />
                        </div>
                    </Card>

                    {supportsLyceumSync ? (
                        <form onSubmit={handleLyceumPasswordSubmit}>
                            <Card>
                                <CardHeader
                                    title="Senha do Lyceum"
                                    subtitle="Use esta área apenas quando você trocar a senha do portal docente. Ela serve para as próximas sincronizações do scraper."
                                    icon={ShieldCheck}
                                />
                                <div className="space-y-4">
                                    <div className="rounded-[22px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-text-secondary">
                                        A senha salva aqui não muda o seu login da NEXORA. Ela apenas permite que a automação continue entrando no Lyceum para atualizar turmas, alunos, notas e frequência.
                                    </div>
                                    {lyceumError ? (
                                        <div className="rounded-[22px] border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                                            {lyceumError}
                                        </div>
                                    ) : null}
                                    {lyceumSuccess ? (
                                        <div className="rounded-[22px] border border-success/20 bg-success/8 px-4 py-3 text-sm text-success">
                                            {lyceumSuccess}
                                        </div>
                                    ) : null}
                                    <Input
                                        label="Nova senha do Lyceum"
                                        type="password"
                                        icon={KeyRound}
                                        value={lyceumForm.lyceum_password}
                                        onChange={(event) => updateLyceumField('lyceum_password', event.target.value)}
                                    />
                                    <Input
                                        label="Confirmar nova senha do Lyceum"
                                        type="password"
                                        icon={KeyRound}
                                        value={lyceumForm.confirm_lyceum_password}
                                        onChange={(event) => updateLyceumField('confirm_lyceum_password', event.target.value)}
                                    />
                                    <Button type="submit" icon={ShieldCheck} loading={lyceumSaving}>
                                        Validar e atualizar senha do Lyceum
                                    </Button>
                                </div>
                            </Card>
                        </form>
                    ) : null}

                    <form onSubmit={handleSystemPasswordSubmit}>
                        <Card>
                            <CardHeader
                                title="Senha da NEXORA"
                                subtitle={supportsLyceumSync
                                    ? 'Esta área altera somente a senha usada para entrar no sistema. Ela pode ser diferente da senha do Lyceum.'
                                    : 'Esta área altera somente a senha usada para entrar no sistema.'}
                                icon={LockKeyhole}
                            />
                            <div className="space-y-4">
                                <div className="rounded-[22px] border border-accent-blue/15 bg-accent-blue/5 px-4 py-3 text-sm text-text-secondary">
                                    Depois da aprovação da conta, você pode manter uma senha própria para a NEXORA.
                                </div>
                                {systemError ? (
                                    <div className="rounded-[22px] border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                                        {systemError}
                                    </div>
                                ) : null}
                                {systemSuccess ? (
                                    <div className="rounded-[22px] border border-success/20 bg-success/8 px-4 py-3 text-sm text-success">
                                        {systemSuccess}
                                    </div>
                                ) : null}
                                <Input
                                    label="Senha atual da NEXORA"
                                    type="password"
                                    icon={LockKeyhole}
                                    value={systemForm.current_password}
                                    onChange={(event) => updateSystemField('current_password', event.target.value)}
                                />
                                <Input
                                    label="Nova senha da NEXORA"
                                    type="password"
                                    icon={LockKeyhole}
                                    value={systemForm.new_password}
                                    onChange={(event) => updateSystemField('new_password', event.target.value)}
                                />
                                <Input
                                    label="Confirmar nova senha da NEXORA"
                                    type="password"
                                    icon={LockKeyhole}
                                    value={systemForm.confirm_new_password}
                                    onChange={(event) => updateSystemField('confirm_new_password', event.target.value)}
                                />
                                <Button type="submit" icon={LockKeyhole} loading={systemSaving}>
                                    Atualizar senha da NEXORA
                                </Button>
                            </div>
                        </Card>
                    </form>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader
                            title="Resumo do Lyceum"
                            icon={ShieldCheck}
                        />
                        <div className="grid grid-cols-1 gap-4">
                            <SummaryTile label="Usuário atual" value={user?.username || '-'} />
                            <SummaryTile label="Turmas sincronizadas" value={String(classesCount)} />
                            <SummaryTile label="Alunos" value={String(studentsCount)} />
                            <SummaryTile label="Cursos detectados" value={String((liveCatalog?.courses || []).length)} />
                        </div>
                    </Card>

                    <Card>
                        <CardHeader
                            title="Cursos detectados"
                            icon={ShieldCheck}
                        />
                        {(liveCatalog?.courses || []).length > 0 ? (
                            <div className="space-y-3">
                                {liveCatalog.courses.map((course) => (
                                    <div key={course.academic_course_name} className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4">
                                        <p className="text-sm font-semibold text-text-primary">{course.academic_course_name}</p>
                                        <p className="mt-1 text-sm text-text-secondary">
                                            {course.classes_count || 0} turmas - {course.students_count || 0} alunos
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-text-secondary">
                                Os cursos aparecerão aqui assim que houver dados do Lyceum para a sua conta.
                            </p>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
}

function ReadOnlyField({ label, value }) {
    return (
        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
            <p className="text-sm font-medium text-text-secondary">{label}</p>
            <p className="mt-2 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function SummaryTile({ label, value }) {
    return (
        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}
