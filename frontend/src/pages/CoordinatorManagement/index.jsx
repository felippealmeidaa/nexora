import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, Shield, Trash2, Users } from 'lucide-react';

import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

export function CoordinatorManagement() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingCoordinatorId, setDeletingCoordinatorId] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [courses, setCourses] = useState([]);
    const [approvals, setApprovals] = useState([]);
    const [coordinators, setCoordinators] = useState([]);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({
        code: '',
        full_name: '',
        course_names: [],
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [coursesRes, approvalsRes, coordinatorsRes] = await Promise.all([
                api.get('/admin/live-courses'),
                api.get('/admin/coordinator-approvals'),
                api.get('/admin/coordinators'),
            ]);
            setCourses(coursesRes.data?.courses || []);
            setApprovals(approvalsRes.data || []);
            setCoordinators(coordinatorsRes.data || []);
        } catch (err) {
            console.error('Erro ao carregar módulo de coordenadores', err);
            setError(err.response?.data?.detail || 'Não foi possível carregar o módulo de coordenadores.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const visibleCourses = useMemo(() => (
        courses.filter((course) => normalizeText(course).includes(normalizeText(search)))
    ), [courses, search]);

    const toggleCourse = (courseName) => {
        setForm((previous) => {
            const exists = previous.course_names.some((item) => normalizeText(item) === normalizeText(courseName));
            return {
                ...previous,
                course_names: exists
                    ? previous.course_names.filter((item) => normalizeText(item) !== normalizeText(courseName))
                    : [...previous.course_names, courseName],
            };
        });
        setError('');
        setSuccess('');
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await api.post('/admin/coordinator-approvals', {
                code: form.code.trim(),
                full_name: form.full_name.trim(),
                course_names: form.course_names,
            });
            setForm({ code: '', full_name: '', course_names: [] });
            setSuccess('Aprovação de coordenador criada com sucesso.');
            await loadData();
        } catch (err) {
            console.error('Erro ao criar aprovação', err);
            setError(err.response?.data?.detail || 'Não foi possível criar a aprovação do coordenador.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCoordinator = async (coordinator) => {
        const confirmed = window.confirm(
            `Tem certeza que deseja excluir a conta de ${coordinator.full_name}? O codigo ${coordinator.username} tambem sera invalidado.`
        );
        if (!confirmed) {
            return;
        }

        setDeletingCoordinatorId(coordinator.id);
        setError('');
        setSuccess('');

        try {
            await api.delete(`/admin/coordinators/${coordinator.id}`);
            setSuccess(`A conta de ${coordinator.full_name} foi excluida e o codigo ${coordinator.username} ficou inutilizavel.`);
            await loadData();
        } catch (err) {
            console.error('Erro ao excluir coordenador', err);
            setError(err.response?.data?.detail || 'Nao foi possivel excluir a conta do coordenador.');
        } finally {
            setDeletingCoordinatorId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="inline-flex items-center gap-3 rounded-[24px] border border-border-subtle bg-bg-card px-5 py-4 shadow-card">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-blue/12 text-accent-blue">
                        <Shield className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-semibold text-text-primary">Coordenadores</h2>
                        <p className="text-sm text-text-secondary">
                            Pré-aprove códigos, nomes e cursos que poderão ser usados na criação das contas de coordenação.
                        </p>
                    </div>
                </div>
            </div>

            {error ? (
                <div className="rounded-[22px] border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}
            {success ? (
                <div className="rounded-[22px] border border-success/20 bg-success/8 px-4 py-3 text-sm text-success">
                    {success}
                </div>
            ) : null}

            {loading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-border-subtle bg-bg-card">
                    <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                </div>
            ) : (
                <>
                    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                        <Card>
                            <CardHeader
                                title="Nova aprovação"
                                subtitle="Defina o código, o nome e os cursos coordenados"
                                icon={Plus}
                            />
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Código"
                                    value={form.code}
                                    onChange={(event) => setForm((previous) => ({ ...previous, code: event.target.value }))}
                                    placeholder="Ex: 10001"
                                    required
                                />
                                <Input
                                    label="Nome completo"
                                    value={form.full_name}
                                    onChange={(event) => setForm((previous) => ({ ...previous, full_name: event.target.value }))}
                                    placeholder="Nome do coordenador"
                                    required
                                />
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-text-primary">Cursos liberados</label>
                                    <Input
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder="Buscar curso..."
                                    />
                                    <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                                        {visibleCourses.length > 0 ? visibleCourses.map((course) => {
                                            const checked = form.course_names.some((item) => normalizeText(item) === normalizeText(course));
                                            return (
                                                <label key={course} className={`flex cursor-pointer items-center justify-between rounded-[18px] border px-4 py-3 transition ${
                                                    checked
                                                        ? 'border-accent-blue/35 bg-accent-blue/10'
                                                        : 'border-border-subtle bg-bg-secondary/45'
                                                }`}>
                                                    <span className="text-sm text-text-primary">{course}</span>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleCourse(course)}
                                                        className="h-4 w-4 rounded border-border-subtle"
                                                    />
                                                </label>
                                            );
                                        }) : (
                                            <EmptyState
                                                icon={Shield}
                                                title="Sem cursos vindos do Lyceum"
                                                description="Os cursos aparecem aqui conforme os professores criam conta e o scraper alimenta a base."
                                            />
                                        )}
                                    </div>
                                </div>
                                <Button type="submit" loading={saving}>
                                    Criar aprovação
                                </Button>
                            </form>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Aprovações cadastradas"
                                subtitle="Códigos já liberados para criação de conta"
                                icon={CheckCircle2}
                            />
                            {approvals.length > 0 ? (
                                <div className="space-y-3">
                                    {approvals.map((approval) => (
                                        <div key={approval.id} className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-text-primary">{approval.full_name}</p>
                                                    <p className="mt-1 text-sm text-text-secondary">Código {approval.code}</p>
                                                </div>
                                                <Badge variant={approval.is_claimed ? 'success' : 'info'}>
                                                    {approval.is_claimed ? 'Conta criada' : 'Aguardando uso'}
                                                </Badge>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {(approval.course_names || []).map((course) => (
                                                    <Badge key={`${approval.id}-${course}`} variant="neutral">{course}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={CheckCircle2}
                                    title="Nenhuma aprovação cadastrada"
                                    description="Crie a primeira liberação para coordenador aqui."
                                />
                            )}
                        </Card>
                    </div>

                    <Card>
                        <CardHeader
                            title="Contas de coordenador já criadas"
                            subtitle="Visão das contas que já consumiram uma aprovação"
                            icon={Users}
                        />
                        {coordinators.length > 0 ? (
                            <div className="space-y-3">
                                {coordinators.map((coordinator) => (
                                    <div key={coordinator.id} className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-semibold text-text-primary">{coordinator.full_name}</p>
                                                <p className="mt-1 text-sm text-text-secondary">Login {coordinator.username}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <Badge variant="success">Ativo</Badge>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    icon={Trash2}
                                                    loading={deletingCoordinatorId === coordinator.id}
                                                    onClick={() => handleDeleteCoordinator(coordinator)}
                                                >
                                                    Excluir conta
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {(coordinator.course_names || []).map((course) => (
                                                <Badge key={`${coordinator.id}-${course}`} variant="neutral">{course}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={Users}
                                title="Nenhuma conta criada ainda"
                                description="As contas reais de coordenação aparecerão aqui depois que os códigos forem usados no cadastro."
                            />
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}
