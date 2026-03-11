import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';
import {
    Users, BookOpen, TrendingUp, AlertTriangle,
    GraduationCap, BarChart3, Shield, ArrowUpRight
} from 'lucide-react';

export function CoordinatorDashboard() {
    const [overview, setOverview] = useState(null);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [profileRes, overviewRes, studentsRes, subjectsRes] = await Promise.allSettled([
                    api.get('/coordinators/me'),
                    api.get('/coordinators/me/overview'),
                    api.get('/coordinators/me/students'),
                    api.get('/coordinators/me/subjects'),
                ]);

                if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
                if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
                if (studentsRes.status === 'fulfilled') setStudents(studentsRes.value.data);
                if (subjectsRes.status === 'fulfilled') setSubjects(subjectsRes.value.data);
            } catch (err) {
                console.error('Erro ao carregar dados:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent-amber border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const kpis = overview?.kpis || {};
    const riskSummary = overview?.risk_summary || {};
    const topAtRisk = overview?.top_at_risk || [];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            <PageHeader
                title={`Painel do Coordenador`}
                subtitle={profile ? `Curso: ${profile.academic_course_name}` : 'Carregando...'}
                icon={Shield}
            />

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-accent-blue" />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Total Alunos</p>
                            <p className="text-2xl font-bold text-accent-blue">{kpis.total_students || 0}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-accent-emerald" />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Média Geral (GPA)</p>
                            <p className="text-2xl font-bold text-accent-emerald">{kpis.average_gpa || '0.0'}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-accent-amber" />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Disciplinas</p>
                            <p className="text-2xl font-bold text-accent-amber">{kpis.total_subjects || 0}</p>
                        </div>
                    </div>
                </Card>
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-rose/10 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-accent-rose" />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Em Risco</p>
                            <p className="text-2xl font-bold text-accent-rose">{kpis.at_risk_count || 0}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Risk Summary + Attendance/Pass Rate */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-accent-purple" />
                        Distribuição de Risco
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Baixo', value: riskSummary.low || 0, color: 'accent-emerald' },
                            { label: 'Médio', value: riskSummary.medium || 0, color: 'accent-amber' },
                            { label: 'Alto', value: riskSummary.high || 0, color: 'accent-rose' },
                            { label: 'Crítico', value: riskSummary.critical || 0, color: 'red-500' },
                        ].map(item => (
                            <div key={item.label} className={`p-3 rounded-xl bg-${item.color}/5 border border-${item.color}/10`}>
                                <p className="text-xs text-text-secondary">{item.label}</p>
                                <p className={`text-xl font-bold text-${item.color}`}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card className="p-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-accent-blue" />
                        Indicadores Gerais
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-text-secondary">Taxa de Aprovação</span>
                            <span className="text-lg font-bold text-accent-emerald">
                                {(kpis.pass_rate || 0).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-bg-elevated overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-accent-emerald to-accent-blue transition-all duration-500"
                                style={{ width: `${Math.min(kpis.pass_rate || 0, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center mt-4">
                            <span className="text-sm text-text-secondary">Frequência Média</span>
                            <span className="text-lg font-bold text-accent-blue">
                                {(kpis.average_attendance_rate || 0).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-bg-elevated overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-purple transition-all duration-500"
                                style={{ width: `${Math.min(kpis.average_attendance_rate || 0, 100)}%` }}
                            />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Top At Risk Students */}
            {topAtRisk.length > 0 && (
                <Card className="p-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-accent-rose" />
                        Alunos em Maior Risco
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-xs text-text-secondary border-b border-border-subtle">
                                    <th className="pb-3 pr-4">Aluno</th>
                                    <th className="pb-3 pr-4">Matrícula</th>
                                    <th className="pb-3 pr-4">GPA</th>
                                    <th className="pb-3 pr-4">Frequência</th>
                                    <th className="pb-3">Risco</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topAtRisk.slice(0, 10).map((s, i) => (
                                    <motion.tr
                                        key={s.student_id}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        className="border-b border-border-subtle/50 last:border-0"
                                    >
                                        <td className="py-3 pr-4 text-sm text-text-primary font-medium">{s.student_name}</td>
                                        <td className="py-3 pr-4 text-sm text-text-secondary">{s.registration_number}</td>
                                        <td className="py-3 pr-4 text-sm">
                                            <span className={s.gpa < 5 ? 'text-accent-rose font-semibold' : 'text-text-primary'}>
                                                {s.gpa.toFixed(1)}
                                            </span>
                                        </td>
                                        <td className="py-3 pr-4 text-sm">
                                            <span className={s.attendance_rate < 75 ? 'text-accent-amber font-semibold' : 'text-text-primary'}>
                                                {s.attendance_rate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="py-3">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.risk_level === 'critical' ? 'bg-red-500/10 text-red-500' :
                                                    s.risk_level === 'high' ? 'bg-accent-rose/10 text-accent-rose' :
                                                        s.risk_level === 'medium' ? 'bg-accent-amber/10 text-accent-amber' :
                                                            'bg-accent-emerald/10 text-accent-emerald'
                                                }`}>
                                                {s.risk_level === 'critical' ? 'Crítico' :
                                                    s.risk_level === 'high' ? 'Alto' :
                                                        s.risk_level === 'medium' ? 'Médio' : 'Baixo'}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Subjects Overview */}
            {subjects.length > 0 && (
                <Card className="p-6">
                    <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-accent-amber" />
                        Disciplinas do Curso ({subjects.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {subjects.map((subject, i) => (
                            <motion.div
                                key={subject.course_id}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                                className="p-4 rounded-xl border border-border-subtle bg-bg-elevated/30 hover:bg-bg-elevated/60 transition-all"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-text-primary">{subject.course_name}</p>
                                        <p className="text-xs text-text-secondary mt-0.5">{subject.course_code}</p>
                                    </div>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue font-medium">
                                        {subject.students.length} alunos
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Card>
            )}
        </motion.div>
    );
}
