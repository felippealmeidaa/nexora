import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BrainCircuit, Database, FileSpreadsheet, Loader2, TrendingUp, Users } from 'lucide-react';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useDataMode } from '@/contexts/DataModeContext';
import { buildRolePath } from '@/lib/app-shell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';

function getRiskVariant(level) {
    if (level === 'critical' || level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

const riskLabels = {
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
};

export function RoleDashboard() {
    const { user } = useAuth();
    const { dataMode } = useDataMode();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [payload, setPayload] = useState(null);

    const liveDataRoute = buildRolePath(user?.role, 'live-data');
    const historicalRoute = buildRolePath(user?.role, 'historical-data');
    const analysisRoute = buildRolePath(user?.role, 'analysis-center');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const endpoint = dataMode === 'real'
                ? '/live-data/summary'
                : '/historical-data/analysis-workspace';
            const response = await api.get(endpoint);
            setPayload(response.data);
        } catch (err) {
            console.error('Erro ao carregar dashboard', err);
            setError(err.response?.data?.detail || 'Não foi possível carregar o dashboard do modo atual.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [dataMode]);

    const dashboardData = useMemo(() => {
        if (dataMode === 'real') {
            const kpis = payload?.kpis || {};
            return {
                sourceLabel: 'Dados em tempo real (Lyceum)',
                totalClasses: kpis.total_classes || 0,
                totalStudents: kpis.total_students || 0,
                averageGrade: Number(kpis.average_grade || 0).toFixed(2),
                averageAttendance: Number(kpis.average_attendance_rate || 0).toFixed(1),
                atRiskCount: kpis.at_risk_count || 0,
                passRate: Number(kpis.pass_rate || 0).toFixed(1),
                topAtRisk: payload?.top_at_risk || [],
                courseDistribution: (payload?.classes || []).reduce((accumulator, liveClass) => {
                    const courseName = liveClass.academic_course_name || 'Curso não informado';
                    accumulator[courseName] = (accumulator[courseName] || 0) + 1;
                    return accumulator;
                }, {}),
            };
        }

        const overview = payload?.overview || {};
        const hasHistoricalBase = Number(overview.total_records || 0) > 0;
        return {
            sourceLabel: 'Dashboard de planilhas',
            totalClasses: hasHistoricalBase ? (overview.total_classes || 0) : 0,
            totalStudents: hasHistoricalBase ? (overview.total_students || 0) : 0,
            averageGrade: hasHistoricalBase ? Number(overview.avg_grade || 0).toFixed(2) : '0.00',
            averageAttendance: hasHistoricalBase ? Number(overview.avg_attendance || 0).toFixed(1) : '0.0',
            atRiskCount: hasHistoricalBase
                ? (overview.is_projected
                    ? (overview.preventive_risk_count || 0)
                    : ((payload?.analysis_data?.high_risk_classes || []).reduce((sum, item) => sum + (item.critical_students || 0), 0)))
                : 0,
            passRate: hasHistoricalBase ? Number(100 - ((overview.avg_risk || 0) * 100)).toFixed(1) : '0.0',
            topAtRisk: hasHistoricalBase ? (overview.top_at_risk || []) : [],
            courseDistribution: hasHistoricalBase ? (overview.course_distribution || {}) : {},
        };
    }, [dataMode, payload]);

    return (
        <div className="space-y-6">
            {error ? (
                <div className="rounded-[22px] border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}

            {loading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-border-subtle bg-bg-card">
                    <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Turmas monitoradas" value={dashboardData.totalClasses} helper="Total disponível no modo ativo" icon={Database} tone="indigo" />
                        <MetricCard title="Alunos monitorados" value={dashboardData.totalStudents} helper="Base consolidada do recorte atual" icon={Users} tone="blue" />
                        <MetricCard title="Média geral" value={dashboardData.averageGrade} helper="Notas médias do modo ativo" icon={TrendingUp} tone="emerald" />
                        <MetricCard title="Casos em alerta" value={dashboardData.atRiskCount} helper="Alunos que pedem intervenção" icon={AlertTriangle} tone="rose" />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                        <Card>
                            <CardHeader
                                title="Indicadores principais"
                                subtitle="Resumo rápido do recorte atual"
                                icon={BrainCircuit}
                            />
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <SummaryStat label="Frequência média" value={`${dashboardData.averageAttendance}%`} icon={Users} />
                                <SummaryStat label="Taxa de aprovação estimada" value={`${dashboardData.passRate}%`} icon={TrendingUp} />
                                <SummaryStat label="Fonte ativa" value={dashboardData.sourceLabel} icon={dataMode === 'real' ? Database : FileSpreadsheet} />
                                <SummaryStat label="Abrir módulo detalhado" value={dataMode === 'real' ? 'Dados' : 'Planilhas'} icon={dataMode === 'real' ? Database : FileSpreadsheet} />
                            </div>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link to={dataMode === 'real' ? liveDataRoute : historicalRoute}>
                                    <Button variant="secondary">
                                        {dataMode === 'real' ? 'Abrir dados em tempo real' : 'Abrir histórico de planilhas'}
                                    </Button>
                                </Link>
                                <Link to={analysisRoute}>
                                    <Button>Ir para análises</Button>
                                </Link>
                            </div>
                        </Card>

                        <Card>
                            <CardHeader
                                title="Distribuição por curso"
                                subtitle="Onde está concentrada a base atual"
                                icon={Database}
                            />
                            {Object.keys(dashboardData.courseDistribution || {}).length > 0 ? (
                                <div className="space-y-3">
                                    {Object.entries(dashboardData.courseDistribution)
                                        .sort((left, right) => right[1] - left[1])
                                        .slice(0, 8)
                                        .map(([courseName, total]) => (
                                            <div key={courseName} className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold text-text-primary">{courseName}</p>
                                                    <Badge variant="info">{total}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={Database}
                                    title="Sem cursos carregados"
                                    description="Os cursos aparecem aqui assim que houver dados no modo ativo."
                                />
                            )}
                        </Card>
                    </div>

                    <Card>
                        <CardHeader
                            title="Alunos com maior risco"
                            subtitle="Lista priorizada para ação pedagógica"
                            icon={AlertTriangle}
                        />
                        {dashboardData.topAtRisk.length > 0 ? (
                            <div className="space-y-3">
                                {dashboardData.topAtRisk.map((student) => (
                                    <div key={`${student.student_name}-${student.class_id || student.registration_number || 'risk'}`} className="grid gap-4 rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4 lg:grid-cols-[1.8fr_repeat(3,0.55fr)_0.55fr]">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{student.student_name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">
                                                {student.course_name || student.academic_course_name || 'Curso não informado'}
                                            </p>
                                        </div>
                                        <MiniMetric label="Nota" value={student.gpa != null ? Number(student.gpa).toFixed(2) : (student.average_grade != null ? Number(student.average_grade).toFixed(2) : '--')} />
                                        <MiniMetric label="Frequência" value={student.attendance_rate != null ? `${Number(student.attendance_rate).toFixed(1)}%` : (student.attendance_percentage != null ? `${Number(student.attendance_percentage).toFixed(1)}%` : '--')} />
                                        <MiniMetric label="Risco" value={student.risk_score != null ? `${(Number(student.risk_score) * 100).toFixed(0)}%` : '--'} />
                                        <div className="flex items-center justify-start lg:justify-end">
                                            <Badge variant={getRiskVariant(student.risk_level)}>
                                                {riskLabels[student.risk_level] || student.risk_level}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={AlertTriangle}
                                title="Nenhum caso em destaque"
                                description="Assim que houver risco detectado na base atual, os casos aparecerão aqui."
                            />
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}

function SummaryStat({ icon: Icon, label, value }) {
    return (
        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-accent-blue shadow-sm">
                    <Icon className="h-4 w-4" />
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
                </div>
            </div>
        </div>
    );
}

function MiniMetric({ label, value }) {
    return (
        <div className="rounded-2xl bg-bg-card px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}
