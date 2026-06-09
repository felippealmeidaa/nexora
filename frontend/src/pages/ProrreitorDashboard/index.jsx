/**
 * ProrreitorDashboard — Dashboard exclusivo da Pró-Reitoria.
 *
 * Exibe visão institucional ampla: rankings de cursos, disciplinas críticas,
 * análise de IA estratégica e chat de governança.
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    BookOpen,
    BrainCircuit,
    Layers3,
    Loader2,
    Sparkles,
    TrendingUp,
    Users,
} from 'lucide-react';

import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';

export function ProrreitorDashboard() {
    const [stats, setStats] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [aiInsights, setAiInsights] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [statsRes, workspaceRes] = await Promise.allSettled([
                    api.get('/analytics/proreitor/stats'),
                    api.get('/historical-data/analysis-workspace'),
                ]);

                if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
                if (workspaceRes.status === 'fulfilled') setWorkspace(workspaceRes.value.data);
            } catch (error) {
                console.error('Erro ao carregar dashboard da pró-reitoria', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleGenerateInsights = async () => {
        setAiLoading(true);
        try {
            const res = await api.get('/analytics/proreitor/ai-insights');
            setAiInsights(res.data.insights || res.data.response);
        } catch (err) {
            console.error('Erro ao gerar insights de IA', err);
        } finally {
            setAiLoading(false);
        }
    };

    const handleSendChat = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || chatLoading) return;
        const userMsg = chatInput.trim();
        setChatInput('');
        setChatMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
        setChatLoading(true);
        try {
            const res = await api.post('/analytics/proreitor/chat', { message: userMsg });
            const reply = res.data?.response || res.data?.reply || 'Sem resposta da IA.';
            setChatMessages((prev) => [...prev, { role: 'ai', text: reply }]);
        } catch (err) {
            setChatMessages((prev) => [...prev, { role: 'ai', text: 'Erro ao processar sua mensagem. Tente novamente.' }]);
        } finally {
            setChatLoading(false);
        }
    };

    // KPIs derivados
    const totalCourses = stats?.ranking_courses?.length || 0;
    const totalStudents = stats?.ranking_courses?.reduce((sum, c) => sum + c.student_count, 0) || 0;
    const totalSubjects = stats?.ranking_subjects?.length || 0;
    const atRiskEstimate = workspace?.analysis_data?.by_class?.reduce((sum, cls) => sum + (cls.critical_students || 0), 0) || 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="Pró-Reitoria Acadêmica"
                subtitle="Visão institucional ampla de desempenho, risco pedagógico e governança estratégica de todos os cursos."
                icon={Activity}
                actions={<Badge variant="blue">Visão Institucional</Badge>}
            />

            {/* KPIs Principais */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    title="Cursos monitorados"
                    value={loading ? '...' : totalCourses}
                    icon={Layers3}
                    tone="indigo"
                    helper="Cursos ativos acompanhados no campus"
                />
                <MetricCard
                    title="Alunos ativos"
                    value={loading ? '...' : totalStudents}
                    icon={Users}
                    tone="blue"
                    helper="Matrículas ativas consolidadas"
                />
                <MetricCard
                    title="Disciplinas em escopo"
                    value={loading ? '...' : totalSubjects}
                    icon={BookOpen}
                    tone="amber"
                    helper="Componentes curriculares monitorados"
                />
                <MetricCard
                    title="Alertas de risco"
                    value={loading ? '...' : atRiskEstimate}
                    icon={AlertTriangle}
                    tone="rose"
                    helper="Alunos com prioridade de intervenção"
                />
            </div>

            {/* Botão de Insights de IA */}
            <div className="flex items-center justify-between rounded-[24px] border border-accent-blue/15 bg-gradient-to-r from-accent-blue/5 via-accent-purple/5 to-accent-indigo/5 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent-blue/20 bg-accent-blue/10 text-accent-blue">
                        <BrainCircuit className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-text-primary">Análise Estratégica com IA</p>
                        <p className="text-xs text-text-secondary">Governança acadêmica, evasão e planos de retenção institucional</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="primary"
                    icon={Sparkles}
                    onClick={handleGenerateInsights}
                    loading={aiLoading}
                >
                    {aiInsights ? 'Reanalisar' : 'Gerar Insights'}
                </Button>
            </div>

            {/* Insights de IA + Chat */}
            {aiInsights && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                    <Card>
                        <CardHeader
                            title="Diretrizes e Insights da IA (Gemini)"
                            subtitle="Plano estratégico de governança e ações de retenção institucional"
                            icon={BrainCircuit}
                        />
                        <div className="border-t border-border-subtle bg-bg-secondary/10 p-6 rounded-b-[24px]">
                            <MarkdownRenderer text={aiInsights} />
                        </div>
                    </Card>

                    {/* Chat de IA */}
                    <Card>
                        <CardHeader
                            title="Chat de IA — Pró-Reitoria"
                            subtitle="Pergunte sobre rankings, evasão ou governança"
                            icon={BrainCircuit}
                        />
                        <div className="flex flex-col gap-3 p-4">
                            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                                {chatMessages.length === 0 ? (
                                    <p className="text-center text-xs text-text-tertiary">
                                        Nenhuma mensagem ainda. Faça uma pergunta sobre os dados institucionais.
                                    </p>
                                ) : chatMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`rounded-2xl px-4 py-2.5 text-xs leading-5 ${
                                            msg.role === 'user'
                                                ? 'ml-6 bg-accent-blue/10 text-accent-blue-dark self-end'
                                                : 'mr-6 bg-bg-secondary text-text-secondary'
                                        }`}
                                    >
                                        {msg.text}
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Gerando resposta...
                                    </div>
                                )}
                            </div>
                            <form onSubmit={handleSendChat} className="flex gap-2">
                                <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    placeholder="Pergunte sobre rankings, cursos críticos..."
                                    className="flex-1 rounded-xl border border-border-subtle bg-bg-card px-3 py-2 text-xs text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-blue/40"
                                />
                                <Button type="submit" size="sm" loading={chatLoading} disabled={!chatInput.trim()}>
                                    Enviar
                                </Button>
                            </form>
                        </div>
                    </Card>
                </div>
            )}

            {/* Rankings Institucionais */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card>
                    <CardHeader
                        title="Ranking de desempenho por curso"
                        subtitle="Desempenho agregado ordenado pelo GPA geral do curso"
                        icon={TrendingUp}
                    />
                    <div className="max-h-[380px] space-y-3 overflow-y-auto p-4 pr-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-10 text-text-tertiary">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : stats?.ranking_courses?.length > 0 ? (
                            stats.ranking_courses.map((course, idx) => (
                                <motion.div
                                    key={idx}
                                    className="flex items-center justify-between rounded-2xl border border-border-subtle bg-bg-secondary/40 p-3"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-blue/10 text-[10px] font-bold text-accent-blue">
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <p className="text-xs font-semibold text-text-primary">{course.course_name}</p>
                                            <p className="text-[10px] text-text-secondary">{course.student_count} alunos</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="rounded-xl bg-white px-3 py-1 text-center">
                                            <p className="text-[9px] text-text-tertiary">GPA</p>
                                            <p className="text-xs font-bold text-text-primary">
                                                {course.average_gpa != null ? Number(course.average_gpa).toFixed(2) : '--'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-white px-3 py-1 text-center">
                                            <p className="text-[9px] text-text-tertiary">Frequência</p>
                                            <p className="text-xs font-bold text-text-primary">
                                                {course.average_attendance != null ? `${Number(course.average_attendance).toFixed(1)}%` : '--'}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <EmptyState
                                icon={Layers3}
                                title="Sem dados de cursos"
                                description="Faça upload de planilhas históricas para visualizar o ranking de desempenho."
                            />
                        )}
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Ranking de disciplinas críticas"
                        subtitle="Componentes com menores médias e taxas de aprovação"
                        icon={AlertTriangle}
                    />
                    <div className="max-h-[380px] space-y-3 overflow-y-auto p-4 pr-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-10 text-text-tertiary">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : stats?.ranking_subjects?.length > 0 ? (
                            stats.ranking_subjects.map((sub, idx) => (
                                <motion.div
                                    key={idx}
                                    className="flex items-center justify-between rounded-2xl border border-border-subtle bg-bg-secondary/40 p-3"
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.04 }}
                                >
                                    <div>
                                        <p className="text-xs font-semibold text-text-primary">{sub.subject_name}</p>
                                        <p className="text-[10px] text-text-secondary">{sub.records_count} lançamentos</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="rounded-xl bg-white px-3 py-1 text-center">
                                            <p className="text-[9px] text-text-tertiary">Média</p>
                                            <p className="text-xs font-bold text-text-primary">
                                                {sub.average_grade != null ? Number(sub.average_grade).toFixed(2) : '--'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-white px-3 py-1 text-center">
                                            <p className="text-[9px] text-text-tertiary">Aprovação</p>
                                            <p className="text-xs font-bold text-text-primary">
                                                {sub.pass_rate != null ? `${Number(sub.pass_rate).toFixed(1)}%` : '--'}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <EmptyState
                                icon={BookOpen}
                                title="Sem dados de disciplinas"
                                description="Os rankings de disciplinas aparecerão após o processamento de planilhas históricas."
                            />
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}

// ── Helpers internos ─────────────────────────────────────────────────────────

function MarkdownRenderer({ text }) {
    if (!text) return null;
    const lines = text.split('\n');
    return (
        <div className="space-y-3">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (trimmed.startsWith('###')) return <h4 key={idx} className="mt-4 text-base font-bold text-text-primary">{trimmed.replace('###', '').trim()}</h4>;
                if (trimmed.startsWith('##')) return <h3 key={idx} className="mt-6 text-lg font-bold text-text-primary">{trimmed.replace('##', '').trim()}</h3>;
                if (trimmed.startsWith('#')) return <h2 key={idx} className="mt-6 border-b pb-2 text-xl font-bold text-text-primary">{trimmed.replace('#', '').trim()}</h2>;
                if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                    return <li key={idx} className="ml-5 list-disc text-sm text-text-secondary">{parseBold(trimmed.substring(1).trim())}</li>;
                }
                if (trimmed) return <p key={idx} className="text-sm leading-6 text-text-secondary">{parseBold(trimmed)}</p>;
                return <div key={idx} className="h-2" />;
            })}
        </div>
    );
}

function parseBold(text) {
    const parts = text.split('**');
    return parts.map((part, index) =>
        index % 2 === 1 ? <strong key={index} className="font-semibold text-text-primary">{part}</strong> : part
    );
}
