import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';
import {
    BookOpen, Users, GraduationCap, Mail, Phone,
    ChevronDown, ChevronUp, TrendingUp, AlertTriangle,
    CheckCircle, Filter, BarChart3, Activity, Target,
    PieChart as PieIcon, Shield
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
    AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';

/* ─── Animated Counter ─── */
function useCountUp(end, duration = 1200) {
    const [value, setValue] = useState(0);
    const ref = useRef(null);

    useEffect(() => {
        if (end == null) return;
        const target = typeof end === 'string' ? parseFloat(end) : end;
        if (isNaN(target)) { setValue(end); return; }

        const startTime = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setValue(target * ease);
            if (progress < 1) ref.current = requestAnimationFrame(tick);
        };

        ref.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(ref.current);
    }, [end, duration]);

    return value;
}

/* ─── KPI Card ─── */
function KPICard({ title, value, suffix = '', decimals = 0, icon: Icon, color, loading, index = 0 }) {
    const colorMap = {
        blue: { bg: 'bg-accent-blue/10', text: 'text-accent-blue-light', shadow: 'shadow-glow-sm' },
        purple: { bg: 'bg-accent-purple/10', text: 'text-accent-purple-light', shadow: 'shadow-glow-purple' },
        emerald: { bg: 'bg-accent-emerald/10', text: 'text-accent-emerald', shadow: 'shadow-glow-emerald' },
        amber: { bg: 'bg-accent-amber/10', text: 'text-accent-amber', shadow: 'shadow-glow-amber' },
        rose: { bg: 'bg-accent-rose/10', text: 'text-accent-rose', shadow: 'shadow-glow-rose' },
        cyan: { bg: 'bg-accent-cyan/10', text: 'text-accent-cyan', shadow: '' },
    };

    const c = colorMap[color] || colorMap.blue;
    const animatedValue = useCountUp(loading ? 0 : value, 1500);

    return (
        <Card delay={index * 0.08} className="flex-row items-center gap-4 group">
            <div className={`p-3 rounded-xl ${c.bg} ${c.text} transition-all duration-300 group-hover:scale-110`}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{title}</p>
                <div className="mt-1">
                    {loading ? (
                        <div className="h-8 w-20 bg-white/5 rounded-lg animate-pulse" />
                    ) : (
                        <p className={`text-2xl font-bold ${c.text}`}>
                            {decimals > 0 ? animatedValue.toFixed(decimals) : Math.round(animatedValue)}
                            <span className="text-sm ml-0.5 font-medium opacity-70">{suffix}</span>
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}

/* ─── Custom Tooltip ─── */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="glass-card-static p-3 text-xs border border-border-subtle !rounded-lg">
            <p className="text-gray-400 mb-1 font-medium">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-gray-200 font-semibold">
                    {entry.name}: <span style={{ color: entry.color }}>{entry.value}</span>
                </p>
            ))}
        </div>
    );
}

/* ─── Risk Badge ─── */
function RiskBadge({ level }) {
    const config = {
        critical: { label: 'Crítico', color: 'text-accent-rose bg-accent-rose/10 border-accent-rose/20' },
        high: { label: 'Alto', color: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20' },
        medium: { label: 'Médio', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
        low: { label: 'Baixo', color: 'text-accent-emerald bg-accent-emerald/10 border-accent-emerald/20' },
    };
    const c = config[level] || config.low;
    return (
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${c.color}`}>
            {c.label}
        </span>
    );
}

export function ProfessorDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [overview, setOverview] = useState(null);
    const [subjectStudents, setSubjectStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState({});
    const [selectedCourse, setSelectedCourse] = useState('all');

    const fetchOverview = async (courseId) => {
        try {
            const url = courseId && courseId !== 'all'
                ? `/professors/me/overview?course_id=${courseId}`
                : '/professors/me/overview';
            const res = await api.get(url);
            setOverview(res.data);
        } catch (err) {
            console.error('Erro ao carregar overview:', err);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, studentsRes] = await Promise.allSettled([
                    api.get('/professors/me'),
                    api.get('/professors/me/students'),
                ]);

                if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
                if (studentsRes.status === 'fulfilled') setSubjectStudents(studentsRes.value.data);

                // Fetch professor-scoped overview
                await fetchOverview('all');
            } catch (err) {
                console.error('Erro ao carregar dados:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleCourseChange = async (courseId) => {
        setSelectedCourse(courseId);
        await fetchOverview(courseId);
    };

    const toggleExpand = (id) => {
        setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const kpis = overview?.kpis || {};
    const riskSummary = overview?.risk_summary || {};
    const topAtRisk = overview?.top_at_risk || [];

    // Filter students by selected course
    const filteredSubjects = selectedCourse === 'all'
        ? subjectStudents
        : subjectStudents.filter(s => String(s.course_id) === selectedCourse);

    // Risk donut data
    const riskData = [
        { name: 'Baixo', value: riskSummary.low || 0, color: '#34d399' },
        { name: 'Médio', value: riskSummary.medium || 0, color: '#facc15' },
        { name: 'Alto', value: riskSummary.high || 0, color: '#fb923c' },
        { name: 'Crítico', value: riskSummary.critical || 0, color: '#fb7185' },
    ].filter(d => d.value > 0);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
        >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <PageHeader
                    title={`Olá, Prof. ${profile?.user_name?.split(' ')[0] || user?.full_name?.split(' ')[0] || ''}!`}
                    subtitle="Visão analítica dos seus alunos e turmas"
                    icon={Activity}
                />

                {/* Course Selector */}
                {subjectStudents.length > 0 && (
                    <div className="relative flex items-center gap-2">
                        <Filter className="w-4 h-4 text-text-secondary" />
                        <select
                            value={selectedCourse}
                            onChange={(e) => handleCourseChange(e.target.value)}
                            className="bg-bg-elevated/60 border border-border-subtle text-text-primary text-sm rounded-xl px-4 py-2.5 pr-10 appearance-none cursor-pointer hover:border-accent-purple/40 transition-colors focus:outline-none focus:border-accent-purple/60"
                        >
                            <option value="all">Todas as Disciplinas</option>
                            {subjectStudents.map(s => (
                                <option key={s.course_id} value={String(s.course_id)}>
                                    {s.course_name} ({s.students.length})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                )}
            </div>

            {/* Profile Card */}
            <Card className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-rose flex items-center justify-center">
                        <GraduationCap className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-text-primary">{profile?.user_name || user?.full_name}</h3>
                        <div className="flex flex-wrap gap-4 mt-1.5">
                            {profile?.user_email && (
                                <span className="text-sm text-text-secondary flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> {profile.user_email}
                                </span>
                            )}
                            {profile?.phone && (
                                <span className="text-sm text-text-secondary flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" /> {profile.phone}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <div className="text-center">
                            <p className="text-2xl font-bold text-accent-purple">{profile?.courses?.length || 0}</p>
                            <p className="text-xs text-text-secondary">Disciplinas</p>
                        </div>
                        <div className="text-center">
                            <p className="text-2xl font-bold text-accent-blue">{kpis.active_students || 0}</p>
                            <p className="text-xs text-text-secondary">Alunos</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <KPICard title="Alunos Ativos" value={kpis.active_students} icon={Users} color="blue" loading={loading} index={0} />
                <KPICard title="Disciplinas" value={kpis.total_courses} icon={BookOpen} color="purple" loading={loading} index={1} />
                <KPICard title="GPA Médio" value={kpis.average_gpa} decimals={2} icon={TrendingUp} color="amber" loading={loading} index={2} />
                <KPICard title="Frequência Média" value={kpis.average_attendance_rate} suffix="%" decimals={0} icon={CheckCircle} color="emerald" loading={loading} index={3} />
                <KPICard title="Alunos em Risco" value={kpis.at_risk_count} icon={AlertTriangle} color="rose" loading={loading} index={4} />
                <KPICard title="Taxa de Aprovação" value={kpis.pass_rate} suffix="%" decimals={0} icon={GraduationCap} color="cyan" loading={loading} index={5} />
            </div>

            {/* Performance Trend */}
            <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-accent-blue-light" />
                            Desempenho Geral
                        </h3>
                        <p className="text-xs text-gray-600">Evolução média das turmas no semestre</p>
                    </div>
                    <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-0.5 bg-accent-blue" />
                            <span className="text-gray-500">Frequência (%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-0.5 bg-accent-amber" />
                            <span className="text-gray-500">GPA (x10)</span>
                        </div>
                    </div>
                </div>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={[
                                { month: 'Ago', gpa: 6.2 * 10, freq: 78 },
                                { month: 'Set', gpa: 6.5 * 10, freq: 82 },
                                { month: 'Out', gpa: 6.3 * 10, freq: 80 },
                                { month: 'Nov', gpa: 7.0 * 10, freq: 85 },
                                { month: 'Dez', gpa: 7.2 * 10, freq: 88 },
                            ]}
                        >
                            <defs>
                                <linearGradient id="colorFreq" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#4b5563', fontSize: 10 }}
                                dy={10}
                            />
                            <YAxis hide />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="freq"
                                name="Frequência"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorFreq)"
                            />
                            <Area
                                type="monotone"
                                dataKey="gpa"
                                name="GPA (x10)"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorGpa)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Risk Distribution + Top At Risk */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Risk Donut */}
                <Card delay={0.5}>
                    <h3 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-accent-purple-light" />
                        Distribuição de Risco
                    </h3>
                    <p className="text-xs text-gray-600 mb-4">Classificação dos seus alunos</p>
                    {riskData.length > 0 ? (
                        <>
                            <div className="h-48 w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={riskData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={50}
                                            outerRadius={75}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {riskData.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex flex-col gap-2 mt-2">
                                {riskData.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                            <span className="text-gray-400">{item.name}</span>
                                        </div>
                                        <span className="font-semibold text-gray-300">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
                            Nenhum aluno encontrado
                        </div>
                    )}
                </Card>

                {/* Top At Risk Students */}
                <Card delay={0.6} className="lg:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-300 mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-accent-rose" />
                        Alunos em Maior Risco
                    </h3>
                    <p className="text-xs text-gray-600 mb-4">Alunos que necessitam de maior atenção</p>

                    {topAtRisk.length > 0 ? (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {topAtRisk.map((student, idx) => (
                                <motion.div
                                    key={student.student_id}
                                    className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated/30 hover:bg-bg-elevated/50 transition-colors border border-border-subtle/30"
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-rose/20 to-accent-amber/20 flex items-center justify-center text-xs font-bold text-accent-rose">
                                            {idx + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-text-primary truncate">{student.student_name}</p>
                                            <p className="text-[10px] text-text-secondary">{student.registration_number} • {student.course_name || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                        <div className="text-center hidden sm:block">
                                            <p className="text-gray-500">GPA</p>
                                            <p className="font-bold text-accent-amber">{student.gpa?.toFixed(2)}</p>
                                        </div>
                                        <div className="text-center hidden sm:block">
                                            <p className="text-gray-500">Freq.</p>
                                            <p className="font-bold text-accent-blue-light">{student.attendance_rate?.toFixed(0)}%</p>
                                        </div>
                                        <div className="text-center hidden md:block">
                                            <p className="text-gray-500">Score</p>
                                            <p className="font-bold text-accent-rose">{(student.risk_score * 100).toFixed(0)}%</p>
                                        </div>
                                        <RiskBadge level={student.risk_level} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
                            <div className="text-center">
                                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p>Nenhum aluno em risco identificado</p>
                            </div>
                        </div>
                    )}
                </Card>
            </div>

            {/* Students by Subject */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <Users className="w-5 h-5 text-accent-blue" />
                    Alunos por Disciplina
                </h3>

                {filteredSubjects.length > 0 ? (
                    filteredSubjects.map((subject, idx) => (
                        <motion.div
                            key={subject.course_id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <Card className="overflow-hidden">
                                <button
                                    onClick={() => toggleExpand(subject.course_id)}
                                    className="w-full p-5 flex items-center justify-between hover:bg-bg-elevated/30 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                                            <BookOpen className="w-5 h-5 text-accent-blue" />
                                        </div>
                                        <div className="text-left">
                                            <h4 className="text-sm font-semibold text-text-primary">{subject.course_name}</h4>
                                            <p className="text-xs text-text-secondary">{subject.course_code} • {subject.students.length} alunos</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-text-secondary bg-bg-elevated/50 px-3 py-1 rounded-full">
                                            {subject.students.length} alunos
                                        </span>
                                        {expanded[subject.course_id] ? (
                                            <ChevronUp className="w-5 h-5 text-text-secondary" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-text-secondary" />
                                        )}
                                    </div>
                                </button>

                                {expanded[subject.course_id] && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className="border-t border-border-subtle"
                                    >
                                        {subject.students.length > 0 ? (
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-text-secondary">
                                                        <th className="text-left py-2.5 px-5 text-xs font-medium uppercase tracking-wider">Aluno</th>
                                                        <th className="text-center py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Matrícula</th>
                                                        <th className="text-center py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Curso</th>
                                                        <th className="text-center py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Período</th>
                                                        <th className="text-center py-2.5 px-3 text-xs font-medium uppercase tracking-wider">Horário</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {subject.students.map((s, i) => (
                                                        <tr key={i} className="border-t border-border-subtle/30 hover:bg-bg-elevated/20 transition-colors">
                                                            <td className="py-2.5 px-5 text-text-primary font-medium">{s.student_name}</td>
                                                            <td className="py-2.5 px-3 text-center text-text-secondary font-mono text-xs">{s.registration_number}</td>
                                                            <td className="py-2.5 px-3 text-center text-text-secondary text-xs">{s.course_name || '—'}</td>
                                                            <td className="py-2.5 px-3 text-center text-text-secondary">{s.current_period || '—'}º</td>
                                                            <td className="py-2.5 px-3 text-center text-text-secondary capitalize">{s.class_schedule || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p className="text-center py-4 text-text-secondary text-sm">Nenhum aluno matriculado</p>
                                        )}
                                    </motion.div>
                                )}
                            </Card>
                        </motion.div>
                    ))
                ) : (
                    <Card className="p-8 text-center">
                        <Users className="w-12 h-12 mx-auto mb-3 text-text-secondary opacity-30" />
                        <p className="text-text-secondary">
                            {selectedCourse !== 'all' ? 'Nenhum aluno encontrado para esta disciplina' : 'Nenhuma disciplina atribuída'}
                        </p>
                        {selectedCourse === 'all' && (
                            <p className="text-xs text-text-secondary mt-1">Vá em "Minhas Disciplinas" para selecionar quais disciplinas você leciona</p>
                        )}
                    </Card>
                )}
            </div>
        </motion.div>
    );
}
