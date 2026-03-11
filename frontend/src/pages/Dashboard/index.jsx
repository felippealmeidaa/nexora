import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Users, BookOpen, GraduationCap, AlertTriangle, TrendingUp, CheckCircle, Activity } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '@/services/api';

/* ─── Animated counter ─── */
function useCountUp(end, duration = 1200) {
    const [value, setValue] = useState(0);
    const ref = useRef(null);

    useEffect(() => {
        if (end == null) return;
        const target = typeof end === 'string' ? parseFloat(end) : end;
        if (isNaN(target)) { setValue(end); return; }

        let start = 0;
        const startTime = performance.now();

        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
            setValue(start + (target - start) * ease);
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

/* ─── Dashboard ─── */
export function Dashboard() {
    const { user } = useAuth();

    // Students should not see the global dashboard
    if (user?.role?.toLowerCase() === 'student') {
        return <Navigate to="/student/dashboard" replace />;
    }
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchOverview() {
            try {
                const response = await api.get('/analytics/overview');
                setData(response.data);
            } catch (error) {
                console.error("Failed to fetch overview", error);
            } finally {
                setLoading(false);
            }
        }
        fetchOverview();
    }, []);

    const kpis = data?.kpis || {};

    // Trend data for area chart
    const trendData = [
        { month: 'Ago', gpa: 0, freq: 0 },
        { month: 'Set', gpa: 0, freq: 0 },
        { month: 'Out', gpa: 0, freq: 0 },
        { month: 'Nov', gpa: 0, freq: 0 },
        { month: 'Dez', gpa: 0, freq: 0 },
        { month: 'Jan', gpa: 0, freq: 0 },
        { month: 'Fev', gpa: kpis.average_gpa ?? 0, freq: kpis.average_attendance_rate ?? 0 },
    ];

    // Donut data for risk distribution
    const riskData = [
        { name: 'Baixo Risco', value: (kpis.active_students ?? 0) - (kpis.at_risk_count ?? 0), color: '#34d399' },
        { name: 'Em Risco', value: kpis.at_risk_count ?? 0, color: '#fb7185' },
    ];

    return (
        <div className="space-y-8">
            <PageHeader
                title="Visão Geral"
                subtitle="Monitoramento em tempo real dos indicadores acadêmicos"
                icon={Activity}
            />

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <KPICard title="Alunos Ativos" value={kpis.active_students} icon={Users} color="blue" loading={loading} index={0} />
                <KPICard title="Disciplinas" value={kpis.total_courses} icon={BookOpen} color="purple" loading={loading} index={1} />
                <KPICard title="GPA Médio" value={kpis.average_gpa} decimals={2} icon={TrendingUp} color="amber" loading={loading} index={2} />
                <KPICard title="Frequência Média" value={kpis.average_attendance_rate} suffix="%" decimals={0} icon={CheckCircle} color="emerald" loading={loading} index={3} />
                <KPICard title="Alunos em Risco" value={kpis.at_risk_count} icon={AlertTriangle} color="rose" loading={loading} index={4} />
                <KPICard title="Taxa de Aprovação" value={kpis.pass_rate} suffix="%" decimals={0} icon={GraduationCap} color="cyan" loading={loading} index={5} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Trend Chart */}
                <Card delay={0.5} className="lg:col-span-2">
                    <h3 className="text-sm font-semibold text-gray-300 mb-1">Tendência de Desempenho</h3>
                    <p className="text-xs text-gray-600 mb-6">GPA médio e frequência ao longo dos meses</p>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="gpaGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="freqGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                                        <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="month" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} width={30} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="gpa" name="GPA" stroke="#818cf8" strokeWidth={2} fill="url(#gpaGradient)" dot={{ fill: '#818cf8', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#818cf8', stroke: '#0a0f1e', strokeWidth: 2 }} />
                                <Area type="monotone" dataKey="freq" name="Frequência" stroke="#34d399" strokeWidth={2} fill="url(#freqGradient)" dot={{ fill: '#34d399', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#34d399', stroke: '#0a0f1e', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Risk Donut */}
                <Card delay={0.6}>
                    <h3 className="text-sm font-semibold text-gray-300 mb-1">Distribuição de Risco</h3>
                    <p className="text-xs text-gray-600 mb-4">Proporção de alunos em risco</p>
                    <div className="h-56 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={riskData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={85}
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
                </Card>
            </div>
        </div>
    );
}
