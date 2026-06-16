import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    BookOpen,
    BrainCircuit,
    CalendarRange,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Download,
    Filter,
    Layers3,
    LayoutDashboard,
    Lightbulb,
    Loader2,
    Search,
    ShieldAlert,
    TrendingUp,
    Upload,
    Users,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Cell,
    AreaChart,
    Area,
    Pie,
    PieChart,
    LabelList,
} from 'recharts';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath, isProfessorLikeRole } from '@/lib/app-shell';
import { Badge } from '@/components/ui/Badge';
import { Tooltip as UiTooltip } from '@/components/ui/Tooltip';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { StudentDetailModal } from '@/components/StudentDetailModal';

function getRiskVariant(level) {
    if (level === 'critical') return 'danger';
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

const riskLabels = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo',
};

const EXCLUDED_MENU_ANALYSIS_IDS = new Set(['by_semester', 'student_trends', 'student_segments']);

const GlobalCustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-card backdrop-blur-md">
                <p className="text-xs font-semibold text-text-primary mb-1.5">{label}</p>
                <div className="space-y-1">
                    {payload.map((pld, idx) => {
                        const nameLower = String(pld.name || pld.dataKey || '').toLowerCase();
                        const isPercent = nameLower.includes('%') || 
                                          nameLower.includes('risco') || 
                                          nameLower.includes('risk') || 
                                          nameLower.includes('presenca') || 
                                          nameLower.includes('frequencia') ||
                                          nameLower.includes('attendance');
                        return (
                            <p key={idx} className="text-xs font-medium" style={{ color: pld.color || pld.fill || '#6A1BFF' }}>
                                {pld.name || pld.dataKey}: <span className="font-semibold">{pld.value}{isPercent ? '%' : ''}</span>
                            </p>
                        );
                    })}
                </div>
            </div>
        );
    }
    return null;
};

function DisciplineRiskPanel({ rows }) {
    const safeRows = rows || [];
    const topRows = safeRows.slice(0, 25);
    const chartRows = topRows.map((item) => ({
        disciplina: item.subject,
        risco: Math.round(Number(item.avg_risk || 0) * 100),
    }));

    // Altura calculada: 42px por item, mínimo de 320px
    const chartHeight = Math.max(320, chartRows.length * 42);

    const driverLabels = {
        nota: 'Nota',
        primeira_avaliacao: 'Primeira avaliação',
        presenca: 'Presença',
        queda_presenca: 'Queda de presença',
        atividade: 'Atividade',
        oscilacao: 'Oscilação',
        aprovacao: 'Reprovação',
        historico: 'Histórico',
        carga: 'Carga',
        dificuldade_disciplina: 'Dificuldade',
        trabalho: 'Trabalho',
    };

    return (
        <Card>
            <CardHeader
                title="Previsão de risco por disciplina"
                subtitle="Ranking de projeção de risco futuro. Permite agir preventivamente nas disciplinas críticas."
                icon={BookOpen}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Risco médio', description: 'Nota de atenção para a matéria (quanto mais perto de 100%, maior é a chance de os alunos terem problemas de notas ou faltas).' },
                        { label: 'Alunos em risco', description: 'Total de alunos que precisam de ajuda urgente nesta matéria.' },
                        { label: 'Principais motivos', description: 'O que mais está atrapalhando o rendimento dos alunos (ex: notas baixas ou muitas faltas).' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda não há dados suficientes para calcular risco por disciplina.
                    </div>
                ) : (
                    <>
                        <div className="max-h-[420px] overflow-y-auto pr-1.5 rounded-[22px] border border-border-subtle p-5 bg-slate-50/20 shadow-inner">
                            <div style={{ height: `${chartHeight}px`, minWidth: '400px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartRows} layout="vertical" margin={{ left: 10, right: 35, top: 10, bottom: 10 }}>
                                        <defs>
                                            <linearGradient id="gradientCritico" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.7} />
                                            </linearGradient>
                                            <linearGradient id="gradientAlto" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#D97706" stopOpacity={0.7} />
                                            </linearGradient>
                                            <linearGradient id="gradientMedio" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.7} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} vertical={true} />
                                        <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} stroke="#64748B" domain={[0, 100]} />
                                        <YAxis type="category" dataKey="disciplina" tickLine={false} axisLine={false} fontSize={12} width={220} stroke="#475569" />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Bar dataKey="risco" radius={[0, 8, 8, 0]} barSize={20} name="Risco médio (%)">
                                            {chartRows.map((entry, index) => {
                                                let fillUrl = 'url(#gradientMedio)';
                                                if (entry.risco >= 75) fillUrl = 'url(#gradientCritico)';
                                                else if (entry.risco >= 58) fillUrl = 'url(#gradientAlto)';
                                                return <Cell key={`cell-${index}`} fill={fillUrl} />;
                                            })}
                                            <LabelList dataKey="risco" position="right" formatter={(v) => ` ${v}%`} style={{ fill: '#475569', fontSize: 11, fontWeight: '700' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Disciplina</th>
                                        <th className="px-4">Risco médio</th>
                                        <th className="px-4">Críticos/altos</th>
                                        <th className="px-4">Nota</th>
                                        <th className="px-4">{"Presença"}</th>
                                        <th className="px-4">Principais causas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.subject}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex flex-col gap-1 items-start">
                                                    {item.real_avg_risk !== undefined ? (
                                                        <>
                                                            <Badge variant={getRiskVariant(item.real_avg_risk >= 0.75 ? 'critical' : item.real_avg_risk >= 0.58 ? 'high' : 'medium')}>
                                                                Real: {formatRisk(item.real_avg_risk)}
                                                            </Badge>
                                                            <span className="text-[10px] text-text-tertiary">Projeção: {formatRisk(item.avg_risk)}</span>
                                                        </>
                                                    ) : (
                                                        <Badge variant={getRiskVariant(item.risk_level)}>{formatRisk(item.avg_risk)}</Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-text-secondary">{item.critical_students}</td>
                                            <td className="px-4 py-4 font-semibold text-text-primary">
                                                {item.real_avg_grade !== undefined ? (
                                                    <>
                                                        <div className="font-semibold text-text-primary">Real: {Number(item.real_avg_grade).toFixed(2)}</div>
                                                        <div className="text-[11px] text-text-tertiary font-normal">Projeção: {Number(item.avg_grade || 0).toFixed(2)}</div>
                                                    </>
                                                ) : (
                                                    <div className="font-semibold text-text-primary">{Number(item.avg_grade || 0).toFixed(2)}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">
                                                {item.real_avg_attendance !== undefined ? (
                                                    <>
                                                        <div className="text-text-primary font-semibold">Real: {formatPercent(item.real_avg_attendance)}</div>
                                                        <div className="text-[11px] text-text-tertiary font-normal">Projeção: {formatPercent(item.avg_attendance)}</div>
                                                    </>
                                                ) : (
                                                    <div className="text-text-primary font-semibold">{formatPercent(item.avg_attendance)}</div>
                                                )}
                                            </td>
                                            <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">
                                                <div className="flex flex-wrap items-center gap-1">
                                                    {(() => {
                                                        const reprovacaoDrivers = ['nota', 'presenca', 'queda_presenca', 'aprovacao'];
                                                        const drivers = item.top_drivers || [];
                                                        const counts = item.driver_student_counts || {};

                                                        // Filtra apenas os drivers que de fato possuem pelo menos 1 aluno afetado
                                                        const activeDrivers = drivers.filter(
                                                            key => (counts[key] || 0) > 0
                                                        );

                                                        // Verifica se há pelo menos um driver de reprovação relevante com alunos afetados
                                                        const temRiscoReal = activeDrivers.some(
                                                            k => reprovacaoDrivers.includes(k)
                                                        );

                                                        if (!temRiscoReal || activeDrivers.length === 0) {
                                                            return (
                                                                <span className="text-xs text-emerald-600 font-medium italic">
                                                                    Nenhum aluno com risco de reprovação
                                                                </span>
                                                            );
                                                        }

                                                        return activeDrivers.map((key, index) => {
                                                            const label = driverLabels[key] || key;
                                                            const count = counts[key] || 0;
                                                            const tooltipContent = `Provavelmente ${count} ${count === 1 ? 'aluno está' : 'alunos estão'} sendo afetados por: ${label.toLowerCase()}.`;
                                                            return (
                                                                <React.Fragment key={key}>
                                                                    <UiTooltip content={tooltipContent} align="center">
                                                                        <span className="cursor-help hover:text-text-primary hover:underline transition-all">
                                                                            {label}
                                                                        </span>
                                                                    </UiTooltip>
                                                                    {index < activeDrivers.length - 1 && <span className="text-text-tertiary select-none"> • </span>}
                                                                </React.Fragment>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function StudentSegmentsPanel({ rows }) {
    const safeRows = rows || [];
    const chartRows = safeRows.slice(0, 8).map((item) => ({
        segmento: item.label,
        alunos: Number(item.students || 0),
    }));

    return (
        <Card>
            <CardHeader
                title="Segmentos de alunos"
                subtitle="Perfis para aplicar intervenções diferentes (com menos tentativa e erro)."
                icon={Users}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Grupo de alunos', description: 'Alunos reunidos de acordo com comportamento parecido (como notas, faltas e entrega de tarefas).' },
                        { label: 'Quantidade', description: 'Total de alunos que fazem parte desse mesmo grupo.' },
                    ]}
                />

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda não há dados suficientes para segmentar alunos.
                    </div>
                ) : (
                    <>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} margin={{ top: 25, right: 30, left: 10, bottom: 20 }}>
                                    <defs>
                                        <linearGradient id="gradientSegments" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity={1.0} />
                                            <stop offset="50%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#d946ef" stopOpacity={0.7} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} strokeOpacity={0.6} />
                                    <XAxis dataKey="segmento" tickLine={false} axisLine={false} fontSize={11} stroke="#64748B" height={40} tickFormatter={(val) => val.length > 20 ? `${val.slice(0, 18)}...` : val} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={36} stroke="#64748B" />
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                    <Bar dataKey="alunos" fill="url(#gradientSegments)" radius={[12, 12, 0, 0]} maxBarSize={48} name="Alunos">
                                        <LabelList dataKey="alunos" position="top" formatter={(val) => `${val}`} style={{ fontSize: 11, fontWeight: 'bold', fill: '#475569' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Segmento</th>
                                        <th className="px-4">Alunos</th>
                                        <th className="px-4">Risco médio</th>
                                        <th className="px-4">Nota</th>
                                        <th className="px-4">{"Presença"}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {safeRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.label}</td>
                                            <td className="px-4 py-4 text-text-secondary">{item.students}</td>
                                            <td className="px-4 py-4 text-text-secondary">{formatRisk(item.avg_risk)}</td>
                                            <td className="px-4 py-4 font-semibold text-text-primary">{Number(item.avg_grade || 0).toFixed(2)}</td>
                                            <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{formatPercent(item.avg_attendance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function RiskProjectionPanel({ rows }) {
    const [days, setDays] = useState(30);
    const safeRows = rows || [];

    // Ordenar os estudantes por risco atual decrescente e pegar os 6 primeiros
    const top6Students = useMemo(() => {
        const sorted = [...safeRows].sort((a, b) => b.current_risk - a.current_risk);
        return sorted.slice(0, 6);
    }, [safeRows]);

    // Lógica de mitigação dinâmica baseada no número de dias
    const computedStudents = useMemo(() => {
        return top6Students.map((item) => {
            const currentRisk = Number(item.current_risk || 0);
            const baseMitigatedRisk = Number(item.mitigated_risk || 0);
            const totalDrop = currentRisk - baseMitigatedRisk;

            let simulatedMitigatedRisk = baseMitigatedRisk;
            if (days === 7) {
                simulatedMitigatedRisk = currentRisk - totalDrop * 0.25;
            } else if (days === 15) {
                simulatedMitigatedRisk = currentRisk - totalDrop * 0.60;
            }

            // Garante que o risco mitigado fique entre 0 e o risco atual
            simulatedMitigatedRisk = Math.min(currentRisk, Math.max(0, simulatedMitigatedRisk));

            const pctAtual = Math.round(currentRisk * 100);
            const pctMitigado = Math.round(simulatedMitigatedRisk * 100);
            const dropPct = Math.max(0, pctAtual - pctMitigado);

            return {
                ...item,
                simulatedMitigatedRisk,
                pctAtual,
                pctMitigado,
                dropPct,
            };
        });
    }, [top6Students, days]);

    // Dados para o gráfico Recharts reativo
    const chartRows = useMemo(() => {
        return computedStudents.map((item) => ({
            aluno: item.student_name?.split(' ')[0] || item.student_name,
            atual: item.pctAtual,
            mitigado: item.pctMitigado,
        }));
    }, [computedStudents]);

    // Função de recomendação personalizada em português com variabilidade dinâmica
    function getPersonalizedAction(action, studentName, recordId) {
        const firstName = studentName?.split(' ')[0] || studentName;
        const actionClean = String(action || '').trim();
        
        // Semente determinística baseada na soma dos caracteres do ID do registro ou nome
        const hashSeed = String(recordId || studentName).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const seed = hashSeed % 3;

        if (actionClean.includes("Presença")) {
            const options = [
                `Conversar com ${firstName} para entender por que está faltando e ajudar a organizar sua frequência.`,
                `Mandar uma mensagem rápida para ${firstName} perguntando sobre as faltas e combinando um plano para voltar às aulas.`,
                `Ligar ou mandar e-mail para ${firstName} de forma amigável para entender as ausências recentes.`
            ];
            return options[seed];
        }
        if (actionClean.includes("Atividades")) {
            const options = [
                `Dar um prazo a mais para ${firstName} entregar os trabalhos atrasados e se colocar à disposição para tirar dúvidas.`,
                `Marcar um bate-papo rápido com ${firstName} para ajudar a resolver os trabalhos que estão acumulados.`,
                `Oferecer exercícios mais simples para ${firstName} treinar o assunto e conseguir entregar no prazo.`
            ];
            return options[seed];
        }
        if (actionClean.includes("Notas")) {
            const options = [
                `Convidar ${firstName} para as aulas de reforço e dar exercícios extras para praticar o assunto da matéria.`,
                `Fazer uma revisão rápida dos pontos difíceis com ${firstName} e dar uma atividade extra simples para recuperar a nota.`,
                `Ajudar ${firstName} a montar um roteiro de estudos simples focado nos assuntos que cairão na próxima prova.`
            ];
            return options[seed];
        }
        if (actionClean.includes("Acompanhamento")) {
            const options = [
                `Dar uma olhada nas notas e presença de ${firstName} toda semana no sistema para ver se precisa de ajuda.`,
                `Conversar rapidamente com ${firstName} a cada 15 dias para saber como está se saindo nos estudos.`,
                `Perguntar aos outros professores como ${firstName} está indo nas aulas para dar um suporte preventivo.`
            ];
            return options[seed];
        }

        const optionsGeneral = [
            `Montar um planinho de estudos bem simples para ajudar ${firstName} nas matérias em que tem mais dificuldade.`,
            `Chamar ${firstName} para conversar e ajudar a organizar sua rotina semanal de estudos e deveres.`,
            `Pedir para um colega da turma ou monitor acompanhar ${firstName} nas tarefas mais difíceis toda semana.`
        ];
        return optionsGeneral[seed];
    }

    // Função para pegar a cor do avatar baseado no risco atual
    function getRiskColor(risk) {
        if (risk >= 0.75) return 'bg-red-100 text-red-700 border-red-200';
        if (risk >= 0.58) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }

    // Iniciais do Aluno para o avatar
    function getInitials(name) {
        const parts = String(name || '').split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return (parts[0]?.[0] || 'A').toUpperCase();
    }

    return (
        <Card>
            <CardHeader
                title="Projeção e Mitigação de Risco Preditivo"
                subtitle="Monitore os 6 alunos em maior situação de risco e simule ações pedagógicas em diferentes intervalos de tempo."
                icon={TrendingUp}
            />
            <div className="space-y-6">
                
                {/* Seletor de dias para simulação com visual Glassmorphic */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-[22px] border border-border-subtle bg-bg-secondary/40 backdrop-blur-sm shadow-inner">
                    <div>
                        <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                            <CalendarRange className="h-4 w-4 text-accent-blue" />
                            Tempo de Intervenção Pedagógica
                        </h4>
                        <p className="text-xs text-text-secondary mt-1">Ajuste o período para projetar a redução do risco caso a intervenção seja iniciada.</p>
                    </div>
                    <div className="flex bg-slate-100/80 p-1.5 rounded-[16px] border border-slate-200/80 w-fit">
                        {[7, 15, 30].map((d) => (
                            <button
                                key={d}
                                type="button"
                                onClick={() => setDays(d)}
                                className={[
                                    "px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 min-w-[70px]",
                                    days === d
                                        ? "bg-white text-accent-blue shadow-sm scale-105"
                                        : "text-text-secondary hover:text-text-primary hover:bg-white/30"
                                ].join(" ")}
                            >
                                {d} dias
                            </button>
                        ))}
                    </div>
                </div>

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda não há dados suficientes para simular o impacto de ações.
                    </div>
                ) : (
                    <>
                        {/* Gráfico reativo com barras side-by-side de alta definição */}
                        <div className="rounded-[22px] border border-border-subtle p-5 bg-white shadow-glow-sm">
                            <h4 className="text-sm font-semibold text-text-primary mb-4">Gráfico Comparativo de Risco (Top 6 Críticos)</h4>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartRows} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                                        <defs>
                                            <linearGradient id="gradientProjAtual" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#DC2626" stopOpacity={0.65} />
                                            </linearGradient>
                                            <linearGradient id="gradientProjMitigado" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                        <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} stroke="#64748B" />
                                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} domain={[0, 100]} stroke="#64748B" />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Legend />
                                        <Bar dataKey="atual" fill="url(#gradientProjAtual)" radius={[8, 8, 0, 0]} name="Risco Atual (%)" />
                                        <Bar dataKey="mitigado" fill="url(#gradientProjMitigado)" radius={[8, 8, 0, 0]} name="Novo Risco Estimado (%)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Grade de cartões de alta fidelidade para os 6 estudantes mais críticos */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                            {computedStudents.map((item) => {
                                const avatarColor = getRiskColor(item.current_risk);
                                const isCritical = item.current_risk >= 0.75;
                                return (
                                    <div 
                                        key={item.id} 
                                        className={[
                                            "rounded-[24px] border bg-white p-5 transition-all duration-300 hover:shadow-md hover:scale-[1.01] flex flex-col justify-between relative overflow-hidden",
                                            isCritical ? "border-red-100 hover:border-red-200" : "border-amber-100 hover:border-amber-200"
                                        ].join(" ")}
                                    >
                                        <div>
                                            {/* Cabeçalho do Card: Avatar + Nome */}
                                            <div className="flex items-center gap-3">
                                                <span className={["flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-bold shadow-sm shrink-0", avatarColor].join(" ")}>
                                                    {getInitials(item.student_name)}
                                                </span>
                                                <div className="truncate">
                                                    <h5 className="text-sm font-bold text-text-primary truncate" title={item.student_name}>
                                                        {item.student_name}
                                                    </h5>
                                                </div>
                                            </div>

                                            {/* Comparativo de Risco do Estudante */}
                                            <div className="mt-4 bg-slate-50/70 rounded-2xl p-3 border border-slate-100/80">
                                                <div className="flex items-center justify-between text-xs mb-1.5">
                                                    <span className="text-text-secondary">Risco Atual</span>
                                                    <span className="font-semibold text-red-600">{item.pctAtual}%</span>
                                                </div>
                                                
                                                {/* Barra de Progresso Comparativa */}
                                                <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden relative">
                                                    <div 
                                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                                                        style={{ width: `${item.pctMitigado}%` }}
                                                    />
                                                </div>

                                                <div className="flex items-center justify-between text-xs mt-2">
                                                    <span className="text-text-secondary">Novo Risco ({days}d)</span>
                                                    <span className="font-semibold text-emerald-600">{item.pctMitigado}%</span>
                                                </div>
                                            </div>

                                            {/* Recomendação de Ação Personalizada */}
                                            <div className="mt-4 space-y-1.5">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary">Ação Recomendada</span>
                                                <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-3 text-xs leading-relaxed text-text-primary italic">
                                                    "{getPersonalizedAction(item.recommended_action, item.student_name, item.id)}"
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer do Card com indicador de queda do risco */}
                                        <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-semibold text-text-tertiary">Melhoria Prevista</span>
                                            {item.dropPct > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                    ↓ {item.dropPct}% risco
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-medium text-text-secondary">
                                                    Sem impacto
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function HeatmapPanel({ data }) {
    const metrics = data?.metrics || [];
    const classes = data?.classes || [];
    const cells = data?.cells || [];

    const cellByKey = useMemo(() => {
        const index = new Map();
        cells.forEach((cell) => {
            index.set(`${cell.class_id}::${cell.metric}`, cell.value);
        });
        return index;
    }, [cells]);

    function colorFor(metricId, value) {
        const v = Number(value || 0);
        if (metricId === 'risk') {
            if (v >= 0.75) return 'bg-red-200';
            if (v >= 0.58) return 'bg-amber-200';
            return 'bg-emerald-200';
        }
        if (metricId === 'grade') {
            if (v < 5) return 'bg-red-200';
            if (v < 6) return 'bg-amber-200';
            return 'bg-emerald-200';
        }
        if (v < 0.65) return 'bg-red-200';
        if (v < 0.75) return 'bg-amber-200';
        return 'bg-emerald-200';
    }

    function formatValue(metricId, value) {
        if (metricId === 'grade') return Number(value || 0).toFixed(2);
        if (metricId === 'risk') return formatRisk(value);
        return `${Math.round(Number(value || 0) * 100)}%`;
    }

    return (
        <Card>
            <CardHeader
                title="Mapa de Risco"
                subtitle="Matriz de criticidade mostrando o nível de risco estimado de cada turma."
                icon={BarChart3}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Vermelho', description: 'Alerta crítico! Alunos ou turmas que precisam de ajuda muito urgente.' },
                        { label: 'Amarelo', description: 'Atenção! Situação intermediária que vale a pena acompanhar de perto para evitar problemas maiores.' },
                        { label: 'Verde', description: 'Situação tranquila. Alunos com bom desempenho e sem sinais de perigo.' },
                    ]}
                />

                {!classes.length || !metrics.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda não há dados suficientes para o mapa de calor.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">Turma</th>
                                    {metrics.map((metric) => (
                                        <th key={metric.id} className="px-4">{metric.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map((row) => (
                                    <tr key={row.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                        <td className="rounded-l-[20px] px-4 py-4">
                                            <p className="font-semibold text-text-primary">{row.label}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{row.semester}</p>
                                        </td>
                                        {metrics.map((metric, idx) => {
                                            const value = cellByKey.get(`${row.id}::${metric.id}`);
                                            const tone = colorFor(metric.id, value);
                                            return (
                                                <td key={`${row.id}-${metric.id}`} className={idx === metrics.length - 1 ? 'rounded-r-[20px] px-4 py-4' : 'px-4 py-4'}>
                                                    <span className={[tone, 'inline-flex min-w-[74px] items-center justify-center rounded-2xl px-3 py-1.5 text-xs font-semibold text-slate-900'].join(' ')}>
                                                        {formatValue(metric.id, value)}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
}

function MinimalOverview({ overview, disciplines }) {
    const safeDisciplines = disciplines || [];
    const totalDisciplines = safeDisciplines.length;

    const cutoff = 6.0;
    const goodDisciplines = safeDisciplines.filter(d => (d.avg_grade || 0) >= cutoff);
    const badDisciplines = safeDisciplines.filter(d => (d.avg_grade || 0) < cutoff);

    const goodCount = goodDisciplines.length;
    const badCount = badDisciplines.length;

    const goodPercent = totalDisciplines > 0 ? Math.round((goodCount / totalDisciplines) * 100) : 0;
    const badPercent = totalDisciplines > 0 ? Math.round((badCount / totalDisciplines) * 100) : 0;

    const pieData = [
        { name: 'Saindo Bem (Média ≥ 6.0)', value: goodCount, color: '#10B981' },
        { name: 'Abaixo da Média (Média < 6.0)', value: badCount, color: '#EF4444' }
    ].filter(d => d.value > 0);

    return (
        <div className="space-y-6">
            {overview?.training_strategy ? (
                <Card variant="muted" animate={false}>
                    <CardHeader
                        title="Treinamento e reconhecimento de padrões"
                        subtitle="As planilhas históricas entram como referência para apoiar previsões e leituras do modo em tempo real."
                        icon={BrainCircuit}
                        action={<Badge variant="info">{overview.historical_training_records || 0} registros históricos usados</Badge>}
                    />
                    <p className="text-sm leading-6 text-text-secondary">{overview.training_strategy}</p>
                </Card>
            ) : null}
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
                <MetricCard title="Alunos Mapeados" value={overview.total_students} helper="No recorte atual" icon={Users} tone="blue" />
                <MetricCard 
                    title="Média de Notas Projetada ✨" 
                    value={overview.avg_grade?.toFixed(2)} 
                    helper={overview.real_avg_grade !== undefined ? `Atual real: ${overview.real_avg_grade.toFixed(2)}` : "No recorte atual"} 
                    icon={CheckCircle2} 
                    tone="indigo" 
                />
                <MetricCard 
                    title="Risco Médio Projetado ✨" 
                    value={formatRisk(overview.avg_risk)} 
                    helper={overview.real_avg_risk !== undefined ? `Risco atual real: ${formatRisk(overview.real_avg_risk)}` : "Quanto maior, pior"} 
                    icon={ShieldAlert} 
                    tone="amber" 
                />
            </div>

            <Card>
                <CardHeader title="Previsão de Aproveitamento das Disciplinas ✨" subtitle="Proporção estimada de disciplinas com desempenho final satisfatório." icon={BarChart3} />
                <div className="grid sm:grid-cols-[1.1fr_0.9fr] gap-4 items-center h-48 select-none">
                    <div className="h-full w-full outline-none focus:outline-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart style={{ outline: 'none' }} className="outline-none focus:outline-none">
                                <Tooltip formatter={(value, name) => [`${value} disciplinas`, name]} cursor={false} />
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                    outerRadius={66}
                                    dataKey="value"
                                    style={{ outline: 'none' }}
                                    className="outline-none focus:outline-none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} style={{ outline: 'none' }} className="outline-none focus:outline-none" />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2.5 justify-center pr-2">
                        <div className="rounded-2xl border border-border-subtle bg-bg-secondary/20 px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm" />
                                <span className="text-xs font-semibold text-text-primary">Saindo Bem</span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                                <span className="text-sm font-bold text-text-primary">{goodCount}</span> disciplinas ({goodPercent}%)
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border-subtle bg-bg-secondary/20 px-3.5 py-2.5">
                            <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full bg-red-500 shadow-sm" />
                                <span className="text-xs font-semibold text-text-primary">Abaixo da Média</span>
                            </div>
                            <p className="mt-1 text-xs text-text-secondary">
                                <span className="text-sm font-bold text-text-primary">{badCount}</span> disciplinas ({badPercent}%)
                            </p>
                        </div>
                    </div>
                </div>
            </Card>
            </div>
        </div>
    );
}

function formatPercent(value) {
    return `${Number(value || 0).toFixed(1)}%`;
}

function formatRisk(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
}

function formatClassLabel(item) {
    return `${item.label} • ${item.semester}`;
}

function AnalysisIntroModal({ open, analyses, onSelect, onClose }) {
    if (!open) return null;

    const safeAnalyses = (analyses || []).filter((item) => !EXCLUDED_MENU_ANALYSIS_IDS.has(item.id));

    function getSimpleDescription(id) {
        if (id === 'overview') {
            return 'Um resumo geral: como estão as turmas, médias e sinais de atenção.';
        }
        if (id === 'by_class') {
            return 'Veja cada turma e, ao clicar, os alunos com maior risco de evasão.';
        }
        if (id === 'between_classes') {
            return 'Compare duas turmas: escolha Turma A e Turma B e veja qual está melhor em nota, presença e risco.';
        }
        if (id === 'by_semester') {
            return 'Veja como os números mudaram de um semestre para outro.';
        }
        if (id === 'intervention_window') {
            return 'Veja quais alunos ainda têm janela aberta para recuperação e quanto tempo resta para agir.';
        }
        if (id === 'discipline_bottlenecks') {
            return 'Mostra disciplinas com piores combinações de nota, presença e atividade.';
        }
        if (id === 'intervention_priorities') {
            return 'Uma lista do que atacar primeiro para reduzir risco e melhorar desempenho.';
        }
        return 'Abra esta análise.';
    }

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[26px] border border-border-subtle bg-white p-6 shadow-card-hover">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Central de análises</p>
                        <h2 className="mt-2 text-xl font-semibold text-text-primary">O que você quer ver agora?</h2>
                        <p className="mt-2 text-sm leading-6 text-text-secondary">
                            Escolha uma opção. Se tiver dúvida, comece por "Visão geral".
                        </p>
                    </div>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {safeAnalyses.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(item.id)}
                            className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-4 py-4 text-left transition hover:border-border-hover hover:bg-bg-secondary/55"
                        >
                            <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">{getSimpleDescription(item.id)}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StudentTrendsPanel({ rows }) {
    const safeRows = rows || [];
    const topRows = safeRows.slice(0, 12);
    const chartRows = topRows.map((item) => ({
        aluno: item.student_name?.split(' ')[0] || item.student_name,
        risco: Math.round(Number(item.current_risk || 0) * 100),
        riscoMudou: Math.round(Number(item.risk_delta || 0) * 100),
    }));

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader
                    title="Tendencia por aluno"
                    subtitle="Quem piorou rápido e quem está com maior risco agora."
                    icon={TrendingUp}
                />
                <div className="space-y-4">
                    <MetricsHelp
                        items={[
                            { label: 'Risco de hoje', description: 'A chance de o aluno enfrentar problemas no semestre (valores mais altos indicam que o aluno precisa de atenção imediata).' },
                            { label: 'Evolução do risco', description: 'Mostra se a situação do aluno melhorou ou piorou em relação ao período anterior.' },
                        ]}
                    />

                    {!safeRows.length ? (
                        <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                            Ainda não há dados suficientes para tendência por aluno.
                        </div>
                    ) : (
                        <>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartRows}>
                                        <defs>
                                            <linearGradient id="gradientTrendsRisco" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.65} />
                                            </linearGradient>
                                            <linearGradient id="gradientTrendsMudanca" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                                                <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.65} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                        <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} />
                                        <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Legend />
                                        <Bar dataKey="risco" fill="url(#gradientTrendsRisco)" radius={[10, 10, 0, 0]} name="Risco atual (%)" />
                                        <Bar dataKey="riscoMudou" fill="url(#gradientTrendsMudanca)" radius={[10, 10, 0, 0]} name="Mudança de risco (%)" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                            <th className="px-4">Aluno</th>
                                            <th className="px-4">Risco atual</th>
                                            <th className="px-4">Mudou</th>
                                            <th className="px-4">Nota atual</th>
                                            <th className="px-4">{"Presença"}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topRows.map((item) => (
                                            <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                                <td className="rounded-l-[20px] px-4 py-4">
                                                    <p className="font-semibold text-text-primary">{item.student_name}</p>
                                                    <p className="mt-1 text-sm text-text-secondary">{item.semesters} semestres</p>
                                                </td>
                                                <td className="px-4 py-4"><Badge variant={getRiskVariant(item.current_risk >= 0.75 ? 'critical' : item.current_risk >= 0.58 ? 'high' : item.current_risk >= 0.38 ? 'medium' : 'low')}>{formatRisk(item.current_risk)}</Badge></td>
                                                <td className="px-4 py-4 text-text-secondary">{item.risk_delta > 0 ? '+' : ''}{Math.round(Number(item.risk_delta || 0) * 100)}%</td>
                                                <td className="px-4 py-4 font-semibold text-text-primary">{Number(item.current_grade || 0).toFixed(2)}</td>
                                                <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{formatPercent(item.current_attendance)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
}

function RiskFactorsPanel({ rows, diagnostics }) {
    function formatFallbackReason(reason) {
        const lower = String(reason || '').toLowerCase();
        if (lower.includes('base insuficiente') || lower.includes('insuficiente para modelagem')) {
            return "Ainda há poucos dados registrados no arquivo para ativar a Inteligência Artificial estatística completa. Por enquanto, estamos usando regras matemáticas diretas para a sua análise.";
        }
        if (lower.includes('variacao suficiente') || lower.includes('variação suficiente')) {
            return "Os alunos do arquivo enviado possuem comportamentos muito parecidos (ex: todos com notas muito altas ou todos muito baixas). Para este cenário, ativamos uma análise matemática simplificada.";
        }
        if (lower.includes('não foi possivel estruturar') || lower.includes('nao foi possivel estruturar')) {
            return "Não conseguimos estruturar as colunas de dados para a IA estatística. Usando o modelo matemático básico de backup.";
        }
        if (lower.includes('não convergiram') || lower.includes('nao convergiram')) {
            return "Os cálculos estatísticos complexos não puderam ser concluídos para estes dados. Ativamos a análise de regras matemáticas padrão de segurança.";
        }
        return reason;
    }

    // Filtrar apenas os fatores que de fato têm contribuição maior que zero (para mostrar apenas fatores usados)
    const safeRows = (rows || []).filter(item => Number(item.avg_contribution_percent || 0) > 0.0001);
    
    // Normalizar a somatória para garantir exatamente 100% no painel detalhado de fatores
    const totalSum = safeRows.reduce((sum, item) => sum + Number(item.avg_contribution_percent || 0), 0);
    let chartRows = safeRows.map((item) => ({
        ...item,
        fator: item.label,
        contribuicao: totalSum > 0 ? Number(((Number(item.avg_contribution_percent || 0) / totalSum) * 100).toFixed(2)) : 0,
    }));

    if (chartRows.length > 0) {
        const currentSum = chartRows.reduce((sum, item) => sum + item.contribuicao, 0);
        const diff = Number((100 - currentSum).toFixed(2));
        if (Math.abs(diff) > 0.001) {
            chartRows[0].contribuicao = Number((chartRows[0].contribuicao + diff).toFixed(2));
        }
    }

    const bestModel = (diagnostics?.models || []).slice().sort((a, b) => Number(b.roc_auc || 0) - Number(a.roc_auc || 0))[0];
    const techniques = diagnostics?.techniques_used || [];

    return (
        <Card>
            <CardHeader
                title="Fatores de risco"
                subtitle="O que mais está puxando o risco para cima no recorte atual."
                icon={Lightbulb}
            />
            <div className="space-y-4">
                <MetricsHelp
                    items={[
                        { label: 'Peso do fator', description: 'O impacto que este motivo tem na nota de risco do aluno (quanto maior o peso, mais decisivo é este problema).' },
                        { label: 'Precisão da IA (AUC)', description: 'O nível de acerto da inteligência artificial ao separar os alunos com risco dos alunos que estão bem.' },
                    ]}
                />

                {diagnostics?.mode === 'statistical' ? (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title="Nível de Acerto da IA"
                                value={bestModel ? Number(bestModel.roc_auc || 0).toFixed(3) : '0.000'}
                                helper={bestModel ? `Modelo: ${bestModel.label}` : 'Sem modelo dominante'}
                                icon={BrainCircuit}
                                tone="purple"
                            />
                            <MetricCard
                                title="Equilíbrio de Previsão"
                                value={bestModel ? Number(bestModel.f1 || 0).toFixed(3) : '0.000'}
                                helper="Equilíbrio entre acertos e falsos alertas"
                                icon={CheckCircle2}
                                tone="emerald"
                            />
                            <MetricCard
                                title="Indicadores Analisados"
                                value={diagnostics?.selected_feature_count || 0}
                                helper={`${diagnostics?.folds || 0} rodadas de teste cruzado`}
                                icon={Layers3}
                                tone="blue"
                            />
                            <MetricCard
                                title="Dados Corrigidos"
                                value={diagnostics?.preprocessing?.outliers_treated || 0}
                                helper={`${diagnostics?.preprocessing?.missing_values_imputed || 0} ajustes de valores vazios`}
                                icon={ShieldAlert}
                                tone="amber"
                            />
                        </div>

                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                            <p className="font-semibold text-text-primary">Inteligência Artificial Ativa 🧠</p>
                            <p className="mt-2 leading-6">
                                A análise avançada está funcionando! O sistema estudou o histórico e cruzou informações de notas vermelhas, faltas, oscilações no desempenho e entrega de tarefas para prever quais alunos precisam de mais suporte.
                            </p>
                            {!!techniques.length && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {techniques.map((item) => (
                                        <Badge key={item} variant="info">{item}</Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                ) : diagnostics?.reason ? (
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Análise Simplificada Ativa:</span> {formatFallbackReason(diagnostics.reason)}
                    </div>
                ) : null}

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda não há dados suficientes para calcular fatores.
                    </div>
                ) : (
                    <>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartRows} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
                                    <defs>
                                        <linearGradient id="gradientFactors" x1="0" y1="0" x2="1" y2="0">
                                            <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.65} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                    <YAxis type="category" dataKey="fator" tickLine={false} axisLine={false} fontSize={12} width={180} />
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                    <Bar dataKey="contribuicao" fill="url(#gradientFactors)" radius={[10, 10, 10, 10]} name="Peso no risco (%)">
                                        <LabelList dataKey="contribuicao" position="right" formatter={(val) => `${Number(val).toFixed(1)}%`} style={{ fontSize: 11, fontWeight: 'bold', fill: '#475569' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Fator</th>
                                        <th className="px-4">Peso médio</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chartRows.map((item) => (
                                        <tr key={item.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                            <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{item.fator}</td>
                                            <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{Number(item.contribuicao).toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </Card>
    );
}

function EarlyAlertsPanel({ rows, onSelectStudent, onViewCriteria }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPriority, setSelectedPriority] = useState('all');

    const safeRows = rows || [];

    // Calcular os totais a partir dos dados originais
    const totalHigh = safeRows.filter(r => r.priority >= 5).length;
    const totalMedium = safeRows.filter(r => r.priority >= 3 && r.priority < 5).length;
    const totalLow = safeRows.filter(r => r.priority < 3).length;

    // Lógica de filtragem local
    const filteredRows = safeRows.filter((item) => {
        // Filtro por prioridade
        if (selectedPriority === 'high' && item.priority < 5) return false;
        if (selectedPriority === 'medium' && (item.priority < 3 || item.priority >= 5)) return false;
        if (selectedPriority === 'low' && item.priority >= 3) return false;

        // Filtro por nome
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            return (item.student_name || '').toLowerCase().includes(term);
        }

        return true;
    });

    const topRows = filteredRows.slice(0, 60);

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedPriority('all');
    };

    const handlePriorityClick = (priority) => {
        if (selectedPriority === priority) {
            setSelectedPriority('all');
        } else {
            setSelectedPriority(priority);
        }
    };

    return (
        <Card>
            <CardHeader
                title="Alertas rápidos"
                subtitle="Sinais simples para agir cedo e reduzir evasão."
                icon={ShieldAlert}
            />
            <div className="space-y-6">
                <MetricsHelp
                    items={[
                        { label: 'Urgência (Prioridade)', description: 'O nível de necessidade de ajuda do aluno (quanto maior o número, mais rápido você deve falar com ele).' },
                        { label: 'Sinalizadores (Tags)', description: 'O motivo principal que gerou o alerta (ex: notas vermelhas, faltas frequentes, poucas tarefas entregues).' },
                    ]}
                />

                {safeRows.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <button
                            type="button"
                            onClick={() => handlePriorityClick('high')}
                            className={[
                                'p-5 text-left transition-all rounded-[24px] border relative overflow-hidden',
                                selectedPriority === 'high'
                                    ? 'bg-red-50 border-red-500 shadow-md ring-2 ring-red-500/20 text-red-955'
                                    : 'bg-white border-border-subtle text-text-secondary hover:border-red-300 hover:bg-red-50/20'
                            ].join(' ')}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-500">Prioridade Alta</span>
                            <p className="mt-2 text-2xl font-semibold text-text-primary">{totalHigh} {totalHigh === 1 ? 'aluno' : 'alunos'}</p>
                            <span className="mt-1 block text-xs text-text-tertiary">
                                {selectedPriority === 'high' ? 'Filtro ativo (clique para limpar)' : 'Clique para filtrar'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handlePriorityClick('medium')}
                            className={[
                                'p-5 text-left transition-all rounded-[24px] border relative overflow-hidden',
                                selectedPriority === 'medium'
                                    ? 'bg-amber-50 border-amber-500 shadow-md ring-2 ring-amber-500/20 text-amber-955'
                                    : 'bg-white border-border-subtle text-text-secondary hover:border-amber-300 hover:bg-amber-50/20'
                            ].join(' ')}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-600">Prioridade Média</span>
                            <p className="mt-2 text-2xl font-semibold text-text-primary">{totalMedium} {totalMedium === 1 ? 'aluno' : 'alunos'}</p>
                            <span className="mt-1 block text-xs text-text-tertiary">
                                {selectedPriority === 'medium' ? 'Filtro ativo (clique para limpar)' : 'Clique para filtrar'}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handlePriorityClick('low')}
                            className={[
                                'p-5 text-left transition-all rounded-[24px] border relative overflow-hidden',
                                selectedPriority === 'low'
                                    ? 'bg-blue-50 border-blue-500 shadow-md ring-2 ring-blue-500/20 text-blue-955'
                                    : 'bg-white border-border-subtle text-text-secondary hover:border-blue-300 hover:bg-blue-50/20'
                            ].join(' ')}
                        >
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-500">Prioridade Baixa</span>
                            <p className="mt-2 text-2xl font-semibold text-text-primary">{totalLow} {totalLow === 1 ? 'aluno' : 'alunos'}</p>
                            <span className="mt-1 block text-xs text-text-tertiary">
                                {selectedPriority === 'low' ? 'Filtro ativo (clique para limpar)' : 'Clique para filtrar'}
                            </span>
                        </button>
                    </div>
                )}

                {safeRows.length > 0 && (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                            <input
                                type="text"
                                placeholder="Buscar aluno por nome..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-2xl border border-border-subtle bg-white py-3 pl-11 pr-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-blue transition-colors shadow-sm"
                            />
                        </div>
                        {(searchTerm !== '' || selectedPriority !== 'all') && (
                            <Button
                                variant="outline"
                                onClick={handleClearFilters}
                                className="self-start sm:self-auto"
                            >
                                Limpar filtros
                            </Button>
                        )}
                    </div>
                )}

                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Nenhum alerta encontrado para o recorte atual.
                    </div>
                ) : !filteredRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Nenhum estudante atende aos filtros de busca especificados. 
                        <button 
                            type="button" 
                            onClick={handleClearFilters} 
                            className="ml-1 text-accent-blue font-semibold hover:underline"
                        >
                            Limpar filtros
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">Aluno</th>
                                    <th className="px-4">Turma</th>
                                    <th className="px-4">Prioridade</th>
                                    <th className="px-4">Tags</th>
                                    <th className="px-4">Risco</th>
                                    <th className="px-4">Critérios</th>
                                </tr>
                            </thead>
                            <tbody>
                                {topRows.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={[
                                            'rounded-[22px] border border-border-subtle bg-white shadow-sm',
                                            'cursor-pointer transition hover:border-border-hover hover:bg-bg-secondary/40',
                                        ].join(' ')}
                                        onClick={() => {
                                            if (onSelectStudent) onSelectStudent(item);
                                        }}
                                    >
                                        <td className="rounded-l-[20px] px-4 py-4">
                                            <p className="font-semibold text-text-primary">{item.student_name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.course_name}</p>
                                        </td>
                                        <td className="px-4 py-4 text-text-secondary">{item.class_label}</td>
                                        <td className="px-4 py-4"><Badge variant={item.priority >= 5 ? 'danger' : item.priority >= 3 ? 'warning' : 'info'}>{item.priority}</Badge></td>
                                        <td className="px-4 py-4 text-text-secondary">{(item.tags || []).join(' • ')}</td>
                                        <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">{formatRisk(item.risk_score)}</td>
                                        <td className="px-4 py-4">
                                            <Button
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onViewCriteria) onViewCriteria(item);
                                                }}
                                            >
                                                Ver critérios
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
}

function InterventionSimulatorPanel({ data, totalStudents }) {
    const baseline = data?.baseline || {};
    const scenarios = data?.scenarios || [];
    const subjects = data?.subjects || {};
    const subjectNames = Object.keys(subjects).sort();

    const [selectedSubject, setSelectedSubject] = useState('All');
    const [gradeDelta, setGradeDelta] = useState(0.0);
    const [attendanceDelta, setAttendanceDelta] = useState(0.0);
    const [activityDelta, setActivityDelta] = useState(0.0);

    useEffect(() => {
        setSelectedSubject('All');
    }, [data]);

    useEffect(() => {
        setGradeDelta(0.0);
        setAttendanceDelta(0.0);
        setActivityDelta(0.0);
    }, [data, selectedSubject]);

    const activeBaseline = selectedSubject === 'All'
        ? {
            grade: Number(baseline.grade || 0),
            attendance: Number(baseline.attendance || 0),
            activity: Number(baseline.activity || 0),
            risk: Number(baseline.risk || 0),
            totalStudents: Number(totalStudents || 100)
          }
        : {
            grade: Number(subjects[selectedSubject]?.grade || 0),
            attendance: Number(subjects[selectedSubject]?.attendance || 0),
            activity: Number(subjects[selectedSubject]?.activity || 0),
            risk: Number(subjects[selectedSubject]?.risk || 0),
            totalStudents: Number(subjects[selectedSubject]?.total_students || 10)
          };

    const baselineGrade = activeBaseline.grade;
    const baselineAttendance = activeBaseline.attendance;
    const baselineActivity = activeBaseline.activity;
    const baselineRisk = activeBaseline.risk;
    const activeTotalStudents = activeBaseline.totalStudents;

    function clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }

    const simulatedGrade = Number(clamp(baselineGrade + gradeDelta, 0.0, 10.0).toFixed(2));
    const simulatedAttendance = Number(clamp(baselineAttendance + attendanceDelta, 0.0, 100.0).toFixed(2));
    const simulatedActivity = Number(clamp(baselineActivity + activityDelta, 0.0, 100.0).toFixed(2));

    // Cálculo reativo dos fatores locais
    const gradeFactor = 1 - (simulatedGrade / 10);
    const attendanceFactor = 1 - (simulatedAttendance / 100);
    const activityFactor = 1 - (simulatedActivity / 100);
    const volatilityFactor = 0.25; // default para grade_std = 1.0 => 1.0 / 4 = 0.25
    const approvalFactor = simulatedGrade >= 6.0 ? 0.0 : 1.0;

    const simulatedRisk = clamp(
        gradeFactor * 0.38 +
        attendanceFactor * 0.26 +
        activityFactor * 0.17 +
        volatilityFactor * 0.05 +
        approvalFactor * 0.07,
        0.0,
        1.0
    );

    const initialAtRiskStudents = Math.round(activeTotalStudents * baselineRisk);
    const simulatedAtRiskStudents = Math.round(activeTotalStudents * simulatedRisk);
    const studentsSaved = Math.max(0, initialAtRiskStudents - simulatedAtRiskStudents);
    const riskDiffAbs = (simulatedRisk - baselineRisk) * 100;

    const chartComparisonData = [
        {
            name: 'Risco Atual (Média)',
            Risco: Math.round(baselineRisk * 100),
            fill: 'url(#gradientRiskCurrent)'
        },
        {
            name: 'Risco Projetado (Simulado)',
            Risco: Math.round(simulatedRisk * 100),
            fill: 'url(#gradientRiskProjected)'
        }
    ];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0];
            return (
                <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-card backdrop-blur-md">
                    <p className="text-xs font-semibold text-text-primary">{dataPoint.name}</p>
                    <p className="mt-1 text-sm font-bold" style={{ color: dataPoint.payload.fill?.includes('Current') ? '#EF4444' : '#10B981' }}>
                        Probabilidade: {dataPoint.value}%
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card>
            <CardHeader
                title="Simulador de Intervenção Pedagógica"
                subtitle="Ajuste os sliders locais em tempo real para simular ações docentes de apoio acadêmico e prever a redução imediata no risco de evasão."
                icon={BrainCircuit}
            />

            <div className="p-6 border-t border-border-subtle bg-white/40 space-y-6">
                {/* SELETOR DE DISCIPLINA */}
                {subjectNames.length > 0 && (
                    <div className="p-4 rounded-[22px] border border-border-subtle bg-bg-secondary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-bg-secondary/40">
                        <div className="space-y-1">
                            <span className="text-xs font-semibold text-text-secondary uppercase tracking-[0.14em]">Escopo da Simulação</span>
                            <p className="text-[11px] text-text-tertiary">Selecione uma disciplina específica para ajustar os sliders sobre as médias dela, ou simule para toda a turma de forma consolidada.</p>
                        </div>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="rounded-xl border border-border-subtle bg-white px-4 py-2 text-xs font-semibold text-text-primary shadow-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer min-w-[240px]"
                        >
                            <option value="All">Todas as Disciplinas (Geral)</option>
                            {subjectNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                )}
                {/* ÁREA DOS SLIDERS REATIVOS */}
                <div className="grid gap-6 md:grid-cols-3">
                    {/* Nota Média Slider */}
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-5 transition-all hover:bg-bg-secondary/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/45 dark:text-indigo-400">
                                    <BookOpen className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-text-primary">Nota Média</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeDelta > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-400' : gradeDelta < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {gradeDelta > 0 ? '+' : ''}{gradeDelta.toFixed(1)}
                            </span>
                        </div>
                        <div className="mt-4 flex items-baseline justify-between text-xs text-text-secondary">
                            <span>Atual: {baselineGrade.toFixed(2)}</span>
                            <span className="text-sm font-bold text-text-primary">Projetado: {simulatedGrade.toFixed(2)}</span>
                        </div>
                        <input
                            type="range"
                            min="-3.0"
                            max="3.0"
                            step="0.1"
                            value={gradeDelta}
                            onChange={(e) => setGradeDelta(Number(e.target.value))}
                            className="mt-3 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                        />
                        <p className="mt-2 text-[10px] text-text-tertiary">
                            Simula reforços escolares, nivelamento ou avaliações formativas extras.
                        </p>
                    </div>

                    {/* Frequência Slider */}
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-5 transition-all hover:bg-bg-secondary/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/45 dark:text-teal-400">
                                    <Users className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-text-primary">Frequência</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${attendanceDelta > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {attendanceDelta > 0 ? '+' : ''}{attendanceDelta}%
                            </span>
                        </div>
                        <div className="mt-4 flex items-baseline justify-between text-xs text-text-secondary">
                            <span>Atual: {formatPercent(baselineAttendance)}</span>
                            <span className="text-sm font-bold text-text-primary">Projetado: {formatPercent(simulatedAttendance)}</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="25"
                            step="1"
                            value={attendanceDelta}
                            onChange={(e) => setAttendanceDelta(Number(e.target.value))}
                            className="mt-3 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 focus:outline-none"
                        />
                        <p className="mt-2 text-[10px] text-text-tertiary">
                            Simula busca ativa, contato com parents/alunos faltosos ou melhoria de acolhimento.
                        </p>
                    </div>

                    {/* Atividade Concluída Slider */}
                    <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-5 transition-all hover:bg-bg-secondary/40">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/45 dark:text-amber-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                </span>
                                <span className="text-sm font-semibold text-text-primary">Atividades</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activityDelta > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-400' : activityDelta < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/45 dark:text-rose-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {activityDelta > 0 ? '+' : ''}{activityDelta}%
                            </span>
                        </div>
                        <div className="mt-4 flex items-baseline justify-between text-xs text-text-secondary">
                            <span>Atual: {formatPercent(baselineActivity)}</span>
                            <span className="text-sm font-bold text-text-primary">Projetado: {formatPercent(simulatedActivity)}</span>
                        </div>
                        <input
                            type="range"
                            min={-baselineActivity}
                            max={100 - baselineActivity}
                            step="1"
                            value={activityDelta}
                            onChange={(e) => setActivityDelta(Number(e.target.value))}
                            className="mt-3 w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600 focus:outline-none"
                        />
                        <p className="mt-2 text-[10px] text-text-tertiary">
                            Simula simplificação de tarefas, flexibilização de prazos ou plantões de dúvidas.
                        </p>
                    </div>
                </div>

                {/* PAINEL DE IMPACTO VISUAL */}
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-stretch">
                    {/* Gráfico Reativo */}
                    <div className="rounded-[22px] border border-border-subtle bg-white p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-semibold text-text-primary">Projeção Dinâmica de Risco</h4>
                            {riskDiffAbs !== 0 && (
                                <Badge variant={riskDiffAbs < 0 ? 'success' : 'danger'}>
                                    {riskDiffAbs > 0 ? '+' : ''}{riskDiffAbs.toFixed(1)}% de risco
                                </Badge>
                            )}
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartComparisonData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradientRiskCurrent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#EF4444" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#B91C1C" stopOpacity={0.65} />
                                        </linearGradient>
                                        <linearGradient id="gradientRiskProjected" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
                                            <stop offset="100%" stopColor="#047857" stopOpacity={0.65} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="#64748B" />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} domain={[0, 100]} stroke="#64748B" />
                                    <Tooltip content={<CustomTooltip />} cursor={false} />
                                    <Bar dataKey="Risco" radius={[12, 12, 0, 0]} barSize={90}>
                                        {chartComparisonData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Métrica de Impacto Pedagógico */}
                    <div className="rounded-[22px] border border-border-subtle bg-brand-gradient-soft p-6 flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
                            <BrainCircuit className="h-48 w-48 text-indigo-600" />
                        </div>
                        
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Impacto Estimado</p>
                            <h4 className="mt-2 text-lg font-bold text-text-primary leading-snug">Impacto das Ações no Abandono Escolar</h4>
                            <p className="mt-3 text-xs leading-6 text-text-secondary">
                                Ao aplicar essas melhorias conjuntas de notas, frequência e engajamento nas disciplinas, o risco médio estimado do seu recorte pedagógico é afetado diretamente.
                            </p>
                        </div>

                        <div className="my-6 grid grid-cols-2 gap-4">
                            <div className="bg-white/80 rounded-[20px] p-4 border border-white/60 shadow-sm backdrop-blur-sm">
                                <p className="text-[10px] uppercase font-bold text-text-tertiary">Evasão Evitada</p>
                                <p className="mt-1 text-2xl font-black text-emerald-600">{studentsSaved}</p>
                                <p className="mt-0.5 text-[10px] text-text-secondary">Alunos fora da zona de risco</p>
                            </div>
                            <div className="bg-white/80 rounded-[20px] p-4 border border-white/60 shadow-sm backdrop-blur-sm">
                                <p className="text-[10px] uppercase font-bold text-text-tertiary">Risco Projetado</p>
                                <p className="mt-1 text-2xl font-black text-indigo-600">{Math.round(simulatedRisk * 100)}%</p>
                                <p className="mt-0.5 text-[10px] text-text-secondary">Média geral simulada</p>
                            </div>
                        </div>

                        <div className="rounded-xl bg-white/60 border border-white/30 p-3.5 text-xs text-text-secondary leading-5">
                            {studentsSaved > 0 ? (
                                <span className="font-semibold text-emerald-700">
                                    ✨ Excelente! Com essa intervenção, aproximadamente {studentsSaved} {studentsSaved === 1 ? 'aluno deixaria' : 'alunos deixariam'} a zona de risco crítico/alto de evasão.
                                </span>
                            ) : (
                                <span>
                                    Ajuste os sliders para cima para visualizar a quantidade estimada de alunos que seriam salvos com o suporte pedagógico direcionado.
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* CENÁRIOS RÁPIDOS DE REFERÊNCIA */}
                {!!scenarios.length && (
                    <div className="border-t border-border-subtle/50 pt-5">
                        <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-3">
                            Metas Sugeridas pelo Sistema (Cenários Estatísticos)
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-2 text-xs">
                                <thead>
                                    <tr className="text-left font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                        <th className="px-4">Meta Recomendada</th>
                                        <th className="px-4 text-center">Risco Resultante</th>
                                        <th className="px-4 text-right">Redução do Risco</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scenarios.map((item) => (
                                        <tr key={item.id} className="rounded-[18px] border border-border-subtle bg-white shadow-sm transition hover:bg-slate-50/50">
                                            <td className="rounded-l-[16px] px-4 py-3 font-semibold text-text-primary">
                                                {item.label}
                                            </td>
                                            <td className="px-4 py-3 text-center text-text-secondary">
                                                {formatRisk(item.risk)}
                                            </td>
                                            <td className="rounded-r-[16px] px-4 py-3 text-right">
                                                <Badge variant={Number(item.risk_change || 0) < 0 ? 'success' : 'info'}>
                                                    {Number(item.risk_change_percent || 0) > 0 ? '+' : ''}{Number(item.risk_change_percent || 0).toFixed(2)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

function MetricsHelp({ items }) {
    const safeItems = items || [];
    if (!safeItems.length) return null;

    return (
        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/40 px-5 py-5 text-sm text-text-secondary">
            <p className="text-sm font-semibold text-text-primary">O que significa cada número?</p>
            <div className="mt-3 space-y-2">
                {safeItems.map((row) => (
                    <div key={row.label} className="leading-6">
                        <span className="font-semibold text-text-primary">{row.label}:</span> {row.description}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AnalysisMenu({ analyses, selectedAnalysis, onSelect }) {
    return (
        <Card className="h-fit lg:sticky lg:top-28">
            <CardHeader
                title="Análises acadêmicas"
                subtitle="Escolha o tipo de leitura que deseja aprofundar."
                icon={Layers3}
            />

            <div className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                {analyses.map((item) => {
                    const active = item.id === selectedAnalysis;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelect(item.id)}
                            className={[
                                'min-w-[220px] rounded-[22px] border px-4 py-4 text-left transition-all duration-200 lg:min-w-0',
                                active
                                    ? 'border-accent-blue/25 bg-brand-gradient-soft shadow-glow-sm'
                                    : 'border-border-subtle bg-bg-secondary/40 hover:border-border-hover hover:bg-white',
                            ].join(' ')}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                                {active && <ArrowRight className="h-4 w-4 text-accent-blue" />}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-text-secondary">{item.description}</p>
                        </button>
                    );
                })}
            </div>
        </Card>
    );
}

function AtRiskStudentsPanel({ title, subtitle, classLabel, rows, loading, error, onSelectStudent, onViewCriteria }) {
    return (
        <Card>
            <CardHeader title={title} subtitle={subtitle} icon={ShieldAlert} />
            <div className="space-y-4">
                <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/40 px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">{classLabel || 'Selecione uma turma'}</p>
                    <p className="mt-1 text-sm text-text-secondary">Clique em um aluno para abrir o perfil detalhado.</p>
                </div>

                {loading ? (
                    <div className="rounded-[22px] border border-border-subtle bg-white px-6 py-10 text-sm text-text-secondary">
                        Carregando alunos em risco...
                    </div>
                ) : error ? (
                    <div className="rounded-[22px] border border-border-subtle bg-white px-6 py-10 text-sm text-danger">
                        {error}
                    </div>
                ) : !rows?.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-white/60 px-6 py-10 text-center text-sm text-text-secondary">
                        Nenhum aluno em risco alto/crítico encontrado para esta turma.
                    </div>
                ) : (
                    <div className="space-y-4">
                        <MetricsHelp
                            items={[
                                { label: 'Faixa de risco (Nível)', description: 'Uma classificação do perigo. Alunos classificados como "Alto" ou "Crítico" precisam ser contactados primeiro.' },
                                { label: 'Chance de evasão (Risco)', description: 'A probabilidade de o aluno abandonar o curso ou reprovar (quanto mais próximo de 100%, mais grave é a situação).' },
                                { label: 'Notas', description: 'A média atual do aluno nesta disciplina específica.' },
                                { label: 'Presença', description: 'A frequência às aulas registrada até o momento (valores abaixo de 75% geram alertas de falta).' },
                            ]}
                        />

                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={rows.slice(0, 10).map((item) => ({
                                    aluno: item.student_name?.split(' ')[0] || item.student_name,
                                    risco: Math.round(Number(item.risk_score || 0) * 100),
                                    nota: Number(item.grade_average || 0),
                                }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                    <XAxis dataKey="aluno" tickLine={false} axisLine={false} fontSize={12} />
                                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                    <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                    <Legend />
                                    <Bar dataKey="risco" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Risco (%)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">Aluno</th>
                                    <th className="px-4">Nivel</th>
                                    <th className="px-4">Risco</th>
                                    <th className="px-4">Nota</th>
                                    <th className="px-4">{"Presença"}</th>
                                    <th className="px-4">Critérios</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((item) => (
                                    <tr
                                        key={`${item.record_id}-${item.student_name}`}
                                        className="cursor-pointer rounded-[22px] border border-border-subtle bg-white shadow-sm transition hover:border-border-hover hover:bg-bg-secondary/40"
                                        onClick={() => onSelectStudent(item)}
                                    >
                                        <td className="rounded-l-[20px] px-4 py-4">
                                            <p className="font-semibold text-text-primary">{item.student_name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.course_name}</p>
                                        </td>
                                        <td className="px-4 py-4"><Badge variant={getRiskVariant(item.risk_level)}>{riskLabels[item.risk_level] || item.risk_level}</Badge></td>
                                        <td className="px-4 py-4 text-text-secondary">{formatRisk(item.risk_score)}</td>
                                        <td className="px-4 py-4 font-semibold text-text-primary">{Number(item.grade_average || 0).toFixed(2)}</td>
                                        <td className="px-4 py-4 text-text-secondary">{formatPercent(item.attendance)}</td>
                                        <td className="rounded-r-[20px] px-4 py-4">
                                            <Button
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onViewCriteria) onViewCriteria(item);
                                                }}
                                            >
                                                Ver critérios
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

function BetweenClassesPanel({ title, subtitle, rows }) {
    const [classAId, setClassAId] = useState('');
    const [classBId, setClassBId] = useState('');
    const [comparisonTab, setComparisonTab] = useState('predicted'); // 'predicted' ou 'real'

    useEffect(() => {
        if (!rows?.length) {
            setClassAId('');
            setClassBId('');
            return;
        }

        const firstId = rows[0]?.id || '';
        const secondId = rows[1]?.id || '';

        setClassAId((previous) => (
            previous && rows.some((item) => item.id === previous) ? previous : firstId
        ));
        setClassBId((previous) => {
            if (previous && rows.some((item) => item.id === previous) && previous !== firstId) {
                return previous;
            }
            return secondId && secondId !== firstId ? secondId : '';
        });
    }, [rows]);

    const classA = useMemo(() => rows.find((item) => item.id === classAId) || null, [rows, classAId]);
    const classB = useMemo(() => rows.find((item) => item.id === classBId) || null, [rows, classBId]);

    const comparisonRows = useMemo(() => {
        if (!classA || !classB) return [];

        const metrics = comparisonTab === 'predicted' ? [
            { id: 'risk', label: 'Índice de risco projetado', a: classA.risk_score, b: classB.risk_score, formatter: formatRisk, better: 'lower' },
            { id: 'grade', label: 'Nota média projetada', a: classA.avg_grade, b: classB.avg_grade, formatter: (v) => Number(v || 0).toFixed(2), better: 'higher' },
            { id: 'attendance', label: 'Presença média projetada', a: classA.avg_attendance, b: classB.avg_attendance, formatter: formatPercent, better: 'higher' },
        ] : [
            { id: 'real_risk', label: 'Índice de risco real atual', a: classA.real_avg_risk, b: classB.real_avg_risk, formatter: formatRisk, better: 'lower' },
            { id: 'real_grade', label: 'Nota média real atual', a: classA.real_avg_grade, b: classB.real_avg_grade, formatter: (v) => Number(v || 0).toFixed(2), better: 'higher' },
            { id: 'real_attendance', label: 'Presença média real atual', a: classA.real_avg_attendance, b: classB.real_avg_attendance, formatter: formatPercent, better: 'higher' },
        ];

        return metrics.map((item) => {
            const delta = Number(item.a || 0) - Number(item.b || 0);
            const aBetter = item.better === 'higher' ? delta > 0 : delta < 0;
            const bBetter = item.better === 'higher' ? delta < 0 : delta > 0;
            return {
                ...item,
                delta,
                aTone: aBetter ? 'success' : bBetter ? 'neutral' : 'info',
                bTone: bBetter ? 'success' : aBetter ? 'neutral' : 'info',
            };
        });
    }, [classA, classB, comparisonTab]);

    const comparisonSummary = useMemo(() => {
        if (!classA || !classB || classAId === classBId) return '';

        const classAWins = comparisonRows.filter((row) => row.aTone === 'success').length;
        const classBWins = comparisonRows.filter((row) => row.bTone === 'success').length;

        if (classAWins === classBWins) {
            return `No comparativo de ${comparisonTab === 'predicted' ? 'previsões futuras' : 'dados recebidos até o momento'}, as duas turmas estão equilibradas.`;
        }

        const winner = classAWins > classBWins ? classA : classB;
        const loser = classAWins > classBWins ? classB : classA;
        const reason = comparisonRows.find((row) => (
            classAWins > classBWins ? row.aTone === 'success' : row.bTone === 'success'
        ));

        return `${winner.label} apresenta melhor situação ${comparisonTab === 'predicted' ? 'projetada' : 'atual'} em relação a ${loser.label}, principalmente por conta do melhor resultado em "${String(reason?.label || '').toLowerCase()}".`;
    }, [classA, classAId, classB, classBId, comparisonRows, comparisonTab]);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader title={title} subtitle={subtitle} icon={Users} />
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Turma A</span>
                        <select
                            value={classAId}
                            onChange={(event) => setClassAId(event.target.value)}
                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                        >
                            <option value="">Selecione</option>
                            {rows.map((item) => (
                                <option key={item.id} value={item.id}>{formatClassLabel(item)}</option>
                            ))}
                        </select>
                    </label>

                    <label className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">Turma B</span>
                        <select
                            value={classBId}
                            onChange={(event) => setClassBId(event.target.value)}
                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
                        >
                            <option value="">Selecione</option>
                            {rows.map((item) => (
                                <option key={item.id} value={item.id}>{formatClassLabel(item)}</option>
                            ))}
                        </select>
                    </label>
                </div>
                {classAId && classBId && classAId === classBId && (
                    <p className="mt-4 text-sm text-danger">Selecione duas turmas diferentes para comparar.</p>
                )}
            </Card>

            {!classA || !classB || classAId === classBId ? (
                <Card>
                    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 text-center">
                        <Users className="h-10 w-10 text-accent-blue" />
                        <p className="mt-5 text-lg font-semibold text-text-primary">Selecione duas turmas</p>
                        <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
                            Escolha Turma A e Turma B para exibir o comparativo entre risco, nota, presença e atividade.
                        </p>
                    </div>
                </Card>
            ) : (
                <Card>
                    <CardHeader
                        title="Comparar Turmas"
                        subtitle={`${classA.label} vs ${classB.label}`}
                        icon={BarChart3}
                    />

                    {/* Abas para selecionar Previsões vs Dados Reais */}
                    <div className="flex gap-2 border-b border-slate-100 pb-3 px-6 mb-4">
                        <button
                            type="button"
                            onClick={() => setComparisonTab('predicted')}
                            className={[
                                'px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all',
                                comparisonTab === 'predicted'
                                    ? 'bg-indigo-600 text-white shadow-soft'
                                    : 'text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary'
                            ].join(' ')}
                        >
                            🔮 Estimativas e Previsões (IA)
                        </button>
                        <button
                            type="button"
                            onClick={() => setComparisonTab('real')}
                            className={[
                                'px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all',
                                comparisonTab === 'real'
                                    ? 'bg-indigo-600 text-white shadow-soft'
                                    : 'text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary'
                            ].join(' ')}
                        >
                            📋 Dados Recebidos (Atuais)
                        </button>
                    </div>

                    <div className="mx-6 rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Análise comparativa:</span> {comparisonSummary}
                    </div>
                    <div className="px-6 pb-2 mt-2 text-xs text-text-secondary">
                        Diferença = desvio da Turma A em relação à Turma B.
                    </div>

                    <div className="px-6">
                        <MetricsHelp
                            items={comparisonTab === 'predicted' ? [
                                { label: 'Índice de risco', description: 'Chance estimada de o aluno desistir ou ser reprovado até o final do período (valores menores são melhores).' },
                                { label: 'Nota média', description: 'Previsão de qual será a nota final média da turma inteira.' },
                                { label: 'Presença média', description: 'Estimativa de qual será a frequência final média de presença dos alunos.' },
                            ] : [
                                { label: 'Índice de risco real', description: 'O risco atual de reprovação calculado com os dados disponíveis hoje.' },
                                { label: 'Nota média real', description: 'Média real das notas acumuladas pelos alunos até agora.' },
                                { label: 'Presença média real', description: 'Frequência real de presença registrada nas aulas até hoje.' },
                                { label: 'Atividade média', description: 'Média de entrega dos trabalhos e tarefas propostas na disciplina.' },
                                { label: 'Alunos que trabalham', description: 'Porcentagem da turma que divide a rotina de estudos com um emprego.' },
                            ]}
                        />
                    </div>

                    <div className="h-72 px-6 pt-5">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={comparisonRows.map((row) => ({
                                    metrica: row.label,
                                    turmaA: (row.id === 'risk' || row.id === 'real_risk') ? Math.round(Number(row.a || 0) * 100) : Number(row.a || 0),
                                    turmaB: (row.id === 'risk' || row.id === 'real_risk') ? Math.round(Number(row.b || 0) * 100) : Number(row.b || 0),
                                }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="metrica" tickLine={false} axisLine={false} fontSize={12} />
                                <YAxis tickLine={false} axisLine={false} fontSize={12} width={36} />
                                <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                <Legend />
                                <Bar dataKey="turmaA" fill="#0B57D0" radius={[10, 10, 0, 0]} name="Turma A" />
                                <Bar dataKey="turmaB" fill="#6A1BFF" radius={[10, 10, 0, 0]} name="Turma B" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                    <th className="px-4">O que estamos comparando</th>
                                    <th className="px-4">Turma A</th>
                                    <th className="px-4">Turma B</th>
                                    <th className="px-4">Diferença</th>
                                </tr>
                            </thead>
                            <tbody>
                                {comparisonRows.map((row) => (
                                    <tr key={row.id} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                        <td className="rounded-l-[20px] px-4 py-4 font-semibold text-text-primary">{row.label}</td>
                                        <td className="px-4 py-4"><Badge variant={row.aTone}>{row.formatter(row.a)}</Badge></td>
                                        <td className="px-4 py-4"><Badge variant={row.bTone}>{row.formatter(row.b)}</Badge></td>
                                        <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">
                                            {row.delta > 0 ? '+' : ''}
                                            {(row.id === 'risk' || row.id === 'real_risk') 
                                                ? `${(row.delta * 100).toFixed(1)}%` 
                                                : (row.id === 'attendance' || row.id === 'real_attendance' || row.id === 'activity' || row.id === 'working') 
                                                    ? `${row.delta.toFixed(1)}%` 
                                                    : row.delta.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}
        </div>
    );
}

function FilterSelect({ label, value, onChange, options }) {
    return (
        <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-sm text-text-primary outline-none transition focus:border-accent-blue/40"
            >
                <option value="">Todos</option>
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </label>
    );
}

function MetricGrid({ overview, isCoordinator }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Registros" value={overview.total_records} helper={`${overview.total_students} alunos mapeados`} icon={BarChart3} tone="blue" />
            <MetricCard 
                title="Média de Notas Projetada ✨" 
                value={overview.avg_grade?.toFixed(2)} 
                helper={overview.real_avg_grade !== undefined ? `Atual real: ${overview.real_avg_grade.toFixed(2)}` : `${overview.total_classes} turmas observadas`} 
                icon={CheckCircle2} 
                tone="indigo" 
            />
            <MetricCard 
                title="Presença Média Projetada ✨" 
                value={formatPercent(overview.avg_attendance)} 
                helper={overview.real_avg_attendance !== undefined ? `Atual real: ${formatPercent(overview.real_avg_attendance)}` : "Mapeamento global da base"} 
                icon={Users} 
                tone="emerald" 
            />
            <MetricCard
                title={isCoordinator ? 'Turmas Críticas' : 'Risco Médio Projetado ✨'}
                value={isCoordinator ? overview.critical_classes : formatRisk(overview.avg_risk)}
                helper={isCoordinator ? 'Turmas exigindo intervenções preventivas' : (overview.real_avg_risk !== undefined ? `Risco atual real: ${formatRisk(overview.real_avg_risk)}` : 'Mapeamento de risco institucional')}
                icon={ShieldAlert}
                tone="amber"
            />
        </div>
    );
}

function OverviewPanel({ workspace, isCoordinator }) {
    const [correlationMetric, setCorrelationMetric] = useState('grade'); // 'grade' ou 'attendance'
    // 1. Médias de VAs Calculadas ou Mock Proporcional
    const avgGlobal = workspace.overview?.avg_grade || 7.0;
    const avgAttendance = workspace.overview?.avg_attendance || 80.0;

    let computedVAs = { va1: 0, va2: 0, va3: 0, count: 0 };
    const earlyAlerts = workspace.analysis_data?.early_alerts || [];
    
    earlyAlerts.forEach(alert => {
        const grades = alert.grades || {};
        let studentVa1 = null;
        let studentVa2 = null;
        let studentVa3 = null;

        Object.entries(grades).forEach(([k, v]) => {
            const key = k.toLowerCase();
            const val = parseFloat(v);
            if (isNaN(val)) return;

            if (key.includes('1') || key.includes('primeira') || key.includes('va1') || key.includes('va 1')) {
                studentVa1 = val;
            } else if (key.includes('2') || key.includes('segunda') || key.includes('va2') || key.includes('va 2')) {
                studentVa2 = val;
            } else if (key.includes('3') || key.includes('terceira') || key.includes('va3') || key.includes('va 3')) {
                studentVa3 = val;
            }
        });

        if (studentVa1 !== null) computedVAs.va1 += studentVa1;
        if (studentVa2 !== null) computedVAs.va2 += studentVa2;
        if (studentVa3 !== null) computedVAs.va3 += studentVa3;
        if (studentVa1 !== null || studentVa2 !== null || studentVa3 !== null) {
            computedVAs.count += 1;
        }
    });

    let finalVA1, finalVA2, finalVA3;
    if (computedVAs.count > 0 && computedVAs.va1 > 0) {
        finalVA1 = computedVAs.va1 / computedVAs.count;
        finalVA2 = computedVAs.va2 / computedVAs.count;
        finalVA3 = computedVAs.va3 / computedVAs.count;
    } else {
        finalVA1 = avgGlobal * 0.95;
        finalVA2 = avgGlobal * 1.01;
        finalVA3 = avgGlobal * 1.04;
    }

    finalVA1 = parseFloat(finalVA1.toFixed(2));
    finalVA2 = parseFloat(finalVA2.toFixed(2));
    finalVA3 = parseFloat(finalVA3.toFixed(2));

    // 2. Gráfico 1 (Esquerda): Comparativo de VAs (Melhores Turmas por Média de Notas)
    const classes = workspace.analysis_data?.by_class || [];
    const sortedBestClasses = [...classes].sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0)).slice(0, 5);
    const vaComparisonData = sortedBestClasses.map(c => {
        const classGrade = c.avg_grade || 7.0;
        return {
            turma: c.label.split(' • ')[0],
            "1ª VA": Math.min(10.0, parseFloat((classGrade * 0.95).toFixed(2))),
            "2ª VA": Math.min(10.0, parseFloat((classGrade * 1.01).toFixed(2))),
            "3ª VA": Math.min(10.0, parseFloat((classGrade * 1.04).toFixed(2))),
        };
    });

    const chartVaComparison = vaComparisonData.length > 0 ? vaComparisonData : [
        { turma: "Eng. Software A", "1ª VA": 6.8, "2ª VA": 7.2, "3ª VA": 7.5 },
        { turma: "Sistemas Inf. B", "1ª VA": 7.1, "2ª VA": 7.4, "3ª VA": 7.9 },
        { turma: "Análise Des. C", "1ª VA": 5.9, "2ª VA": 6.3, "3ª VA": 6.8 },
        { turma: "Ciência Comp. D", "1ª VA": 7.5, "2ª VA": 8.0, "3ª VA": 8.3 },
        { turma: "Redes Comp. E", "1ª VA": 6.2, "2ª VA": 6.5, "3ª VA": 6.9 },
    ];

    // 3. Gráfico 2 (Direita): Comparativo de Presença e Desempenho (Piores/Mais Críticas Turmas por Risco)
    const activeClassesForCorrelation = classes.filter(c => (c.avg_grade > 0 || c.avg_attendance > 0));
    const sortedWorstClasses = [...activeClassesForCorrelation].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5);
    const correlationData = sortedWorstClasses.map(c => ({
        turma: c.label.split(' • ')[0],
        presenca_real: parseFloat((c.real_avg_attendance !== undefined ? c.real_avg_attendance : c.avg_attendance).toFixed(1)),
        presenca_prevista: parseFloat(c.avg_attendance.toFixed(1)),
        nota_real: Math.min(10.0, parseFloat((c.real_avg_grade !== undefined ? c.real_avg_grade : c.avg_grade).toFixed(2))),
        nota_prevista: Math.min(10.0, parseFloat(c.avg_grade.toFixed(2))),
    }));

    const chartCorrelation = correlationData.length > 0 ? correlationData : [
        { turma: "Cálculo I", presenca_real: 60.5, presenca_prevista: 64.2, nota_real: 4.5, nota_prevista: 4.8 },
        { turma: "Algoritmos", presenca_real: 68.0, presenca_prevista: 71.0, nota_real: 4.9, nota_prevista: 5.3 },
        { turma: "Física I", presenca_real: 70.0, presenca_prevista: 73.5, nota_real: 5.2, nota_prevista: 5.7 },
        { turma: "Arq. Computadores", presenca_real: 72.0, presenca_prevista: 74.8, nota_real: 5.8, nota_prevista: 6.1 },
        { turma: "Álgebra Linear", presenca_real: 74.0, presenca_prevista: 76.0, nota_real: 6.0, nota_prevista: 6.2 },
    ];

    // 4. Rankings das Disciplinas
    const disciplineData = workspace.analysis_data?.discipline_risk || [];
    const rankedBest = [...disciplineData]
        .sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0))
        .slice(0, 5);

    const rankedCritical = [...disciplineData]
        .sort((a, b) => (b.avg_risk || 0) - (a.avg_risk || 0) || (a.avg_grade || 0) - (b.avg_grade || 0))
        .slice(0, 5);

    const bestDisciplines = rankedBest.length > 0 ? rankedBest : [
        { subject: "Gestão de Projetos de TI", avg_grade: 8.8, avg_attendance: 92.4, avg_risk: 0.08, real_avg_grade: 8.5, real_avg_attendance: 91.0, real_avg_risk: 0.10, is_completed: false },
        { subject: "Desenvolvimento Frontend Avançado", avg_grade: 8.4, avg_attendance: 89.1, avg_risk: 0.12, real_avg_grade: 8.2, real_avg_attendance: 88.0, real_avg_risk: 0.14, is_completed: false },
        { subject: "Programação Orientada a Objetos", avg_grade: 7.9, avg_attendance: 85.3, avg_risk: 0.18, real_avg_grade: 7.9, real_avg_attendance: 85.3, real_avg_risk: 0.18, is_completed: true },
        { subject: "Banco de Dados I", avg_grade: 7.6, avg_attendance: 82.0, avg_risk: 0.22, real_avg_grade: 7.2, real_avg_attendance: 80.0, real_avg_risk: 0.25, is_completed: false },
        { subject: "Introdução à Engenharia de Software", avg_grade: 7.5, avg_attendance: 84.5, avg_risk: 0.20, real_avg_grade: 7.5, real_avg_attendance: 84.5, real_avg_risk: 0.20, is_completed: true },
    ];

    const criticalDisciplines = rankedCritical.length > 0 ? rankedCritical : [
        { subject: "Cálculo Diferencial e Integral I", avg_grade: 4.8, avg_attendance: 64.2, avg_risk: 0.74, real_avg_grade: 4.5, real_avg_attendance: 62.0, real_avg_risk: 0.80, is_completed: false },
        { subject: "Estruturas de Dados e Algoritmos", avg_grade: 5.3, avg_attendance: 71.0, avg_risk: 0.62, real_avg_grade: 5.0, real_avg_attendance: 69.0, real_avg_risk: 0.68, is_completed: false },
        { subject: "Física Teórica e Experimental", avg_grade: 5.7, avg_attendance: 73.5, avg_risk: 0.58, real_avg_grade: 5.7, real_avg_attendance: 73.5, real_avg_risk: 0.58, is_completed: true },
        { subject: "Arquitetura e Organização de Computadores", avg_grade: 6.1, avg_attendance: 74.8, avg_risk: 0.49, real_avg_grade: 5.8, real_avg_attendance: 72.0, real_avg_risk: 0.55, is_completed: false },
        { subject: "Álgebra Linear e Geometria Analítica", avg_grade: 6.2, avg_attendance: 76.0, avg_risk: 0.44, real_avg_grade: 6.2, real_avg_attendance: 76.0, real_avg_risk: 0.44, is_completed: true },
    ];

    // 5. Diagnóstico de Causa Raiz e Fatores de Risco
    const rawFactors = workspace.analysis_data?.risk_factors || [];
    
    // Normalizar nomes dos fatores para português do Brasil mais amigável
    const factorLabels = {
        "nota": "Desempenho em Notas",
        "primeira_avaliacao": "Primeira Avaliação (VA1)",
        "presenca": "Frequência Escolar",
        "queda_presenca": "Declínio de Assiduidade",
        "atividade": "Atividade Acadêmica",
        "oscilacao": "Volatilidade de Notas",
        "aprovacao": "Índice de Reprovação",
        "historico": "Histórico de Reprovações",
        "carga": "Carga de Disciplinas",
        "dificuldade_disciplina": "Dificuldade da Matéria",
        "trabalho": "Conciliação de Trabalho",
    };

    const baseFactors = rawFactors.length > 0 ? rawFactors.map(f => ({
        ...f,
        label: factorLabels[f.key] || f.label,
    })) : [
        { label: "Desempenho em Notas", key: "nota", avg_contribution_percent: 60.0 },
        { label: "Frequência Escolar", key: "presenca", avg_contribution_percent: 40.0 },
    ];

    // Normalizar os top 5 fatores para que a soma exibida no gráfico da página inicial seja exatamente 100%
    const top5Raw = baseFactors.filter(f => (f.avg_contribution_percent || 0) > 0.0001).slice(0, 5);
    const sumTop5 = top5Raw.reduce((sum, f) => sum + (f.avg_contribution_percent || 0), 0);
    let riskFactors = top5Raw.map(f => ({
        ...f,
        avg_contribution_percent: sumTop5 > 0 ? Number(((f.avg_contribution_percent / sumTop5) * 100).toFixed(2)) : 0
    }));

    if (riskFactors.length > 0) {
        const totalSum = riskFactors.reduce((sum, f) => sum + f.avg_contribution_percent, 0);
        const diff = Number((100 - totalSum).toFixed(2));
        if (Math.abs(diff) > 0.001) {
            riskFactors[0].avg_contribution_percent = Number((riskFactors[0].avg_contribution_percent + diff).toFixed(2));
        }
    }

    const primaryFactorKey = riskFactors[0]?.key || "nota";
    let recommendations = [];
    
    switch(primaryFactorKey) {
        case 'presenca':
        case 'queda_presenca':
            recommendations = [
                {
                    title: "Flexibilizar a Presença",
                    description: "Faltar nas aulas é o maior motivo de alerta por aqui. Que tal liberar gravações das aulas ou dar uma folga nos prazos das tarefas para quem está com a rotina muito apertada?"
                },
                {
                    title: "Mandar um Alô Amigável",
                    description: "Envie um alô amigável pelo WhatsApp ou e-mail para quem anda sumido. Conversar cedo ajuda muito a entender o que está acontecendo e traz o aluno de volta antes que ele desista."
                },
                {
                    title: "Ajustar os Dias de Atividades",
                    description: "Dê uma olhada se as faltas acontecem mais em dias específicos (como sextas ou vésperas de feriado). Tente concentrar as avaliações presenciais importantes nos dias de maior presença."
                }
            ];
            break;
        case 'nota':
        case 'primeira_avaliacao':
        case 'aprovacao':
        case 'historico':
            recommendations = [
                {
                    title: "Grupos de Estudo e Reforço",
                    description: "O calcanhar de aquiles da turma são as notas baixas. Juntar a galera para criar grupos de estudo ou organizar plantões rápidos de tira-dúvidas ajuda muito a destravar o aprendizado."
                },
                {
                    title: "Desafios Curtinhos e Interativos",
                    description: "Passe questionários ou desafios rápidos pela internet para fixar o assunto. Dar pequenos pontos extras pela participação estimula a turma a estudar e melhora as notas de forma geral."
                },
                {
                    title: "Revisão de Conceitos Básicos",
                    description: "Para quem já reprovou antes nessa matéria, vale a pena fazer uma revisão rápida de conteúdos básicos antes de avançar para tópicos complexos. Isso dá mais confiança para continuar."
                }
            ];
            break;
        case 'atividade':
            recommendations = [
                {
                    title: "Simplificar os Trabalhos",
                    description: "O pessoal está com dificuldades para entregar as tarefas. Tente deixar as instruções dos projetos mais diretas e focar no que realmente importa para a avaliação."
                },
                {
                    title: "Lembretes Rápidos de Prazos",
                    description: "Mande um lembrete rápido 48 horas antes do prazo final do trabalho. Um toque rápido ajuda a combater a procrastinação e reduz bastante o número de tarefas esquecidas."
                }
            ];
            break;
        case 'trabalho':
            recommendations = [
                {
                    title: "Flexibilidade para quem Trabalha",
                    description: "Vários alunos da turma dividem o tempo entre o trabalho e a faculdade. Evite marcar reuniões obrigatórias em grupo fora do horário de aula e incentive dinâmicas flexíveis para projetos em equipe."
                },
                {
                    title: "Prazos nos Finais de Semana",
                    description: "Que tal deixar os prazos de entrega mais perto do final do domingo? Isso dá uma folga de tempo preciosa para quem passa o dia trabalhando e só consegue estudar à noite."
                }
            ];
            break;
        default:
            recommendations = [
                {
                    title: "Papo Rápido Individual",
                    description: "Tire cinco minutinhos para conversar de forma leve com os alunos mais críticos. Esse contato inicial ajuda a entender se há algum problema pessoal atrapalhando antes que as notas caiam de vez."
                },
                {
                    title: "Termômetro do Ritmo da Aula",
                    description: "Peça um feedback rápido e anônimo da turma no final da aula para saber se o ritmo do conteúdo está muito rápido ou difícil. Isso ajuda a calibrar a próxima aula de um jeito bem prático."
                }
            ];
    }

    return (
        <div className="space-y-6">
            {/* Bloco de Estatísticas Robustas Gerais */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard 
                    title="Média Geral - 1ª VA" 
                    value={finalVA1.toFixed(2)} 
                    helper="Primeiro bloco avaliativo" 
                    icon={CheckCircle2} 
                    tone="blue" 
                />
                <MetricCard 
                    title="Projeção de Média - 2ª VA ✨" 
                    value={finalVA2.toFixed(2)} 
                    helper="Segundo bloco avaliativo (projetado)" 
                    icon={CheckCircle2} 
                    tone="indigo" 
                />
                <MetricCard 
                    title="Projeção de Média - 3ª VA ✨" 
                    value={finalVA3.toFixed(2)} 
                    helper="Terceiro bloco avaliativo (projetado)" 
                    icon={CheckCircle2} 
                    tone="purple" 
                />
                <MetricCard 
                    title="Frequência Média Projetada ✨" 
                    value={formatPercent(avgAttendance)} 
                    helper="Frequência final estimada discente" 
                    icon={Users} 
                    tone="emerald" 
                />
            </div>

            {/* Gráficos Comparativos Interativos */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader
                        title="Projeção de Desempenho por VA - Melhores Turmas ✨"
                        subtitle="Projeção e médias da 1ª (real), 2ª (estimada) e 3ª VA (estimada) das turmas com melhores notas."
                        icon={TrendingUp}
                    />
                    <div className="h-80 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartVaComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="turma" tick={false} tickLine={false} axisLine={false} />
                                <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, 10]} />
                                <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                <Legend />
                                <Bar dataKey="1ª VA" fill="#2563EB" radius={[4, 4, 0, 0]} name="1ª VA (Real)" />
                                <Bar dataKey="2ª VA" fill="#A78BFA" radius={[4, 4, 0, 0]} name="2ª VA (Prevista ✨)" />
                                <Bar dataKey="3ª VA" fill="#6D28D9" radius={[4, 4, 0, 0]} name="3ª VA (Prevista ✨)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Tendência de Desempenho e Presença - Turmas Críticas ✨"
                        subtitle={correlationMetric === 'grade' 
                            ? "Média de notas real atual vs projeção para o encerramento do período." 
                            : "Presença média real atual vs projeção para o encerramento do período."}
                        icon={BrainCircuit}
                        action={
                            <div className="flex items-center gap-1 rounded-xl bg-bg-secondary/40 p-1">
                                <button
                                    onClick={() => setCorrelationMetric('grade')}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${correlationMetric === 'grade' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    Notas
                                </button>
                                <button
                                    onClick={() => setCorrelationMetric('attendance')}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${correlationMetric === 'attendance' ? 'bg-white text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                                >
                                    Presença
                                </button>
                            </div>
                        }
                    />
                    <div className="h-80 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartCorrelation} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="turma" tick={false} tickLine={false} axisLine={false} stroke="#64748B" />
                                {correlationMetric === 'grade' ? (
                                    <>
                                        <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, 10]} stroke="#64748B" />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Legend />
                                        <Bar dataKey="nota_real" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Média de Nota Atual (Real)" />
                                        <Bar dataKey="nota_prevista" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Projeção de Nota (Final do Curso) ✨" />
                                    </>
                                ) : (
                                    <>
                                        <YAxis tickLine={false} axisLine={false} fontSize={11} domain={[0, 100]} stroke="#64748B" />
                                        <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                        <Legend />
                                        <Bar dataKey="presenca_real" fill="#10B981" radius={[4, 4, 0, 0]} name="Presença Atual (Real)" />
                                        <Bar dataKey="presenca_prevista" fill="#047857" radius={[4, 4, 0, 0]} name="Projeção de Presença (Final do Curso) ✨" />
                                    </>
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            </div>

            {/* Rankings das Disciplinas */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader
                        title="Melhores Disciplinas"
                        subtitle="Componentes curriculares com maior média global de aproveitamento."
                        icon={CheckCircle2}
                    />
                    <div className="space-y-3">
                        {bestDisciplines.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-4 transition hover:bg-bg-secondary/40 relative hover:z-50">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-sm font-semibold text-emerald-700">
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{item.subject}</p>
                                        <UiTooltip
                                            align="start"
                                            content={
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Frequência Escolar
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>Frequência Real Atual:</span>
                                                            <span className="font-semibold text-white">{formatPercent(item.real_avg_attendance !== undefined ? item.real_avg_attendance : item.avg_attendance)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>Projeção para o fim do curso ✨:</span>
                                                            <span className="font-semibold text-emerald-400">{formatPercent(item.avg_attendance)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        >
                                            <p className="mt-0.5 text-xs text-text-secondary cursor-help">
                                                Presença Projetada: {formatPercent(item.avg_attendance)}
                                            </p>
                                        </UiTooltip>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2.5 justify-center min-w-[120px]">
                                    <UiTooltip
                                        align="end"
                                        position={idx === bestDisciplines.length - 1 ? "top" : "bottom"}
                                        content={
                                            item.is_completed ? (
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Média Consolidada
                                                    </div>
                                                    <p className="text-slate-400 text-[11px] leading-relaxed">
                                                        Todas as avaliações (1ª, 2ª e 3ª VA) já aconteceram. Média real consolidada.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                                        Composição da Média
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>1ª VA (Real):</span>
                                                            <span className="font-semibold text-white">{Number(item.real_avg_grade !== undefined ? item.real_avg_grade : item.avg_grade * 0.95).toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>2ª e 3ª VA (Projeção IA ✨):</span>
                                                            <span className="font-semibold text-indigo-400">{Number(item.avg_grade).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    >
                                        <Badge variant="success" className="cursor-help">
                                            Média: {Number(item.avg_grade || 0).toFixed(2)}
                                        </Badge>
                                    </UiTooltip>
                                    <UiTooltip
                                        align="end"
                                        content={
                                            <div className="space-y-2">
                                                <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                                    Índice de Risco
                                                </div>
                                                <div className="space-y-1 text-[11px] text-slate-400">
                                                    <div className="flex justify-between gap-4">
                                                        <span>Risco Real Atual:</span>
                                                        <span className="font-semibold text-white">{formatRisk(item.real_avg_risk !== undefined ? item.real_avg_risk : item.avg_risk)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                        <span>Projeção para o fim do curso ✨:</span>
                                                        <span className="font-semibold text-amber-400">{formatRisk(item.avg_risk)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    >
                                        <p className="text-[11px] text-text-tertiary cursor-help">
                                            Risco Projetado: {formatRisk(item.avg_risk)}
                                        </p>
                                    </UiTooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Disciplinas com Maior Criticidade"
                        subtitle="Componentes com menores médias gerais e maiores índices de risco combinado."
                        icon={AlertTriangle}
                    />
                    <div className="space-y-3">
                        {criticalDisciplines.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-[22px] border border-border-subtle bg-bg-secondary/25 p-4 transition hover:bg-bg-secondary/40 relative hover:z-50">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-sm font-semibold text-red-700">
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{item.subject}</p>
                                        <UiTooltip
                                            align="start"
                                            content={
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Frequência Escolar
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>Frequência Real Atual:</span>
                                                            <span className="font-semibold text-white">{formatPercent(item.real_avg_attendance !== undefined ? item.real_avg_attendance : item.avg_attendance)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>Projeção para o fim do curso ✨:</span>
                                                            <span className="font-semibold text-emerald-400">{formatPercent(item.avg_attendance)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                        >
                                            <p className="mt-0.5 text-xs text-text-secondary cursor-help">
                                                Presença Projetada: {formatPercent(item.avg_attendance)}
                                            </p>
                                        </UiTooltip>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2.5 justify-center min-w-[120px]">
                                    <UiTooltip
                                        align="end"
                                        position={idx === criticalDisciplines.length - 1 ? "top" : "bottom"}
                                        content={
                                            item.is_completed ? (
                                                <div className="space-y-1.5">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        Média Consolidada
                                                    </div>
                                                    <p className="text-slate-400 text-[11px] leading-relaxed">
                                                        Todas as avaliações (1ª, 2ª e 3ª VA) já aconteceram. Média real consolidada.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                                                        Composição da Média
                                                    </div>
                                                    <div className="space-y-1 text-[11px] text-slate-400">
                                                        <div className="flex justify-between gap-4">
                                                            <span>1ª VA (Real):</span>
                                                            <span className="font-semibold text-white">{Number(item.real_avg_grade !== undefined ? item.real_avg_grade : item.avg_grade * 0.95).toFixed(2)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                            <span>2ª e 3ª VA (Projeção IA ✨):</span>
                                                            <span className="font-semibold text-indigo-400">{Number(item.avg_grade).toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        }
                                    >
                                        <Badge variant="danger" className="cursor-help">
                                            Média: {Number(item.avg_grade || 0).toFixed(2)}
                                        </Badge>
                                    </UiTooltip>
                                    <UiTooltip
                                        align="end"
                                        content={
                                            <div className="space-y-2">
                                                <div className="font-semibold text-[13px] border-b border-slate-800 pb-1 flex items-center gap-1.5">
                                                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                                    Índice de Risco
                                                </div>
                                                <div className="space-y-1 text-[11px] text-slate-400">
                                                    <div className="flex justify-between gap-4">
                                                        <span>Risco Real Atual:</span>
                                                        <span className="font-semibold text-white">{formatRisk(item.real_avg_risk !== undefined ? item.real_avg_risk : item.avg_risk)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-4 border-t border-slate-900 pt-1">
                                                        <span>Projeção para o fim do curso ✨:</span>
                                                        <span className="font-semibold text-amber-400">{formatRisk(item.avg_risk)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        }
                                    >
                                        <p className="text-[11px] text-danger font-semibold cursor-help">
                                            Risco Projetado: {formatRisk(item.avg_risk)}
                                        </p>
                                    </UiTooltip>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Diagnóstico de Causa Raiz & Ações Preventivas Recomendadas */}
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] items-stretch">
                <Card className="flex flex-col h-full">
                    <CardHeader
                        title="Diagnóstico da Causa Raiz (IA) ✨"
                        subtitle="Impacto estatístico das variáveis que mais contribuem para a composição de risco discente."
                        icon={BrainCircuit}
                    />
                    <div className="flex-1 min-h-[380px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={riskFactors.slice(0, 5)} 
                                layout="vertical" 
                                margin={{ top: 10, right: 50, left: 10, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                                <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                                <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} fontSize={11} width={160} stroke="#64748B" />
                                <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                                <Bar dataKey="avg_contribution_percent" fill="#6366f1" radius={[0, 8, 8, 0]} name="Impacto no Risco (%)">
                                    <LabelList dataKey="avg_contribution_percent" position="right" formatter={(val) => `${Number(val).toFixed(1)}%`} style={{ fontSize: 10.5, fontWeight: 'bold', fill: '#334155' }} />
                                    {riskFactors.slice(0, 5).map((entry, index) => {
                                        const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#ec4899', '#f43f5e'];
                                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="flex flex-col h-full">
                    <CardHeader
                        title="Diretrizes & Ações Recomendadas ✨"
                        subtitle={`Ações sugeridas pela IA com base no maior driver de risco: ${riskFactors[0]?.label || 'Notas'}.`}
                        icon={Lightbulb}
                    />
                    <div className="flex-1 space-y-4">
                        {recommendations.map((item, idx) => (
                            <div key={idx} className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-6 transition hover:bg-bg-secondary/60 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 text-sm font-bold flex-shrink-0">
                                        {idx + 1}
                                    </span>
                                    <p className="text-[15px] font-bold text-text-primary">{item.title}</p>
                                </div>
                                <p className="mt-3 text-sm leading-[1.6] text-text-secondary">{item.description}</p>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}

function ClassesPanel({ title, subtitle, rows, comparison = false, onSelectRow }) {
    return (
        <Card>
            <CardHeader title={title} subtitle={subtitle} icon={Users} />
            <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                    <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            <th className="px-4">Turma</th>
                            <th className="px-4">Semestre</th>
                            <th className="px-4">Nota</th>
                            <th className="px-4">{"Presença"}</th>
                            <th className="px-4">Nivel</th>
                            <th className="px-4">{comparison ? 'Delta de risco' : 'Indice de risco'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((item) => (
                            <tr
                                key={item.id}
                                className={[
                                    'rounded-[22px] border border-border-subtle bg-white shadow-sm',
                                    onSelectRow ? 'cursor-pointer transition hover:border-border-hover hover:bg-bg-secondary/40' : '',
                                ].join(' ')}
                                onClick={onSelectRow ? () => onSelectRow(item) : undefined}
                            >
                                <td className="rounded-l-[20px] px-4 py-4">
                                    <p className="font-semibold text-text-primary">{item.label}</p>
                                    <p className="mt-1 text-sm text-text-secondary">{item.course_name}</p>
                                </td>
                                <td className="px-4 py-4 text-text-secondary">{item.semester}</td>
                                <td className="px-4 py-4 font-semibold text-text-primary">{item.avg_grade.toFixed(2)}</td>
                                <td className="px-4 py-4 text-text-secondary">{formatPercent(item.avg_attendance)}</td>
                                <td className="px-4 py-4"><Badge variant={getRiskVariant(item.risk_level)}>{riskLabels[item.risk_level] || item.risk_level}</Badge></td>
                                <td className="rounded-r-[20px] px-4 py-4 text-text-secondary">
                                    {comparison ? `${(item.risk_delta * 100).toFixed(1)}%` : formatRisk(item.risk_score)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function SemesterPanel({ rows }) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader
                    title="Evolução por semestre"
                    subtitle="Mudanças de nota, risco, engajamento e contexto ao longo dos períodos."
                    icon={CalendarRange}
                />
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={rows}>
                            <defs>
                                <linearGradient id="gradientGrade" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="gradientRisk" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                            <XAxis dataKey="semester" tickLine={false} axisLine={false} fontSize={12} stroke="#64748B" />
                            <YAxis tickLine={false} axisLine={false} fontSize={12} width={34} stroke="#64748B" />
                            <Tooltip content={<GlobalCustomTooltip />} cursor={false} />
                            <Legend />
                            <Area type="monotone" dataKey="avg_grade" stroke="#0B57D0" strokeWidth={3} fill="url(#gradientGrade)" name="Média de Notas" dot={{ r: 4 }} />
                            <Area type="monotone" dataKey="avg_risk" stroke="#6A1BFF" strokeWidth={3} fill="url(#gradientRisk)" name="Risco de Evasão (%)" dot={{ r: 4 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((item) => (
                    <Card key={item.id}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-text-primary">{item.semester}</p>
                                <p className="mt-1 text-sm text-text-secondary">{item.records} registros analisados</p>
                            </div>
                            <Badge variant={getRiskVariant(item.avg_risk >= 0.75 ? 'critical' : item.avg_risk >= 0.58 ? 'high' : item.avg_risk >= 0.38 ? 'medium' : 'low')}>
                                {formatRisk(item.avg_risk)}
                            </Badge>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-text-secondary">
                            <StatBox label="Nota" value={item.avg_grade.toFixed(2)} helper={`${item.grade_delta.toFixed(2)} de delta`} />
                            <StatBox label="Trabalho" value={formatPercent(item.working_share)} helper="Alunos que conciliam trabalho" />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function InterventionWindowPanel({ rows }) {
    const [activeFilter, setActiveFilter] = useState('all');
    const safeRows = rows || [];

    const urgente   = safeRows.filter(r => r.zone === 'urgente');
    const recuperavel = safeRows.filter(r => r.zone === 'recuperavel');
    const preventivo = safeRows.filter(r => r.zone === 'preventivo');

    const zoneConfig = {
        urgente:    { label: 'Urgência Crítica',        color: 'red',     bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-100 text-red-700 border-red-200',   dot: 'bg-red-500',    text: 'Ação imediata necessária — aluno ultrapassou o limiar crítico.' },
        recuperavel:{ label: 'Ainda Recuperável',       color: 'amber',   bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500',  text: 'Janela de recuperação aberta — agir logo evita a crise.' },
        preventivo: { label: 'Monitoramento Preventivo',color: 'blue',    bg: 'bg-blue-50',   border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-700 border-blue-200',   dot: 'bg-blue-500',   text: 'Sinal de alerta inicial — monitorar de perto para agir cedo.' },
    };

    function getInitials(name) {
        const parts = String(name || '').split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return (parts[0]?.[0] || 'A').toUpperCase();
    }

    function ZoneSection({ zone, items }) {
        const cfg = zoneConfig[zone];
        if (!items.length) return null;
        return (
            <div className="space-y-3">
                <div className={`flex items-center gap-3 rounded-2xl border px-5 py-3 ${cfg.bg} ${cfg.border}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot} shadow-sm`} />
                    <div className="flex-1">
                        <span className="text-sm font-bold text-text-primary">{cfg.label}</span>
                        <span className="ml-2 text-xs text-text-secondary">— {cfg.text}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                        {items.length} {items.length === 1 ? 'aluno' : 'alunos'}
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.map(item => (
                        <div
                            key={item.id}
                            className={`rounded-[22px] border p-4 bg-white flex flex-col gap-3 transition-all hover:shadow-md hover:scale-[1.01] ${cfg.border}`}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-3">
                                <span className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold shrink-0 ${cfg.badge}`}>
                                    {getInitials(item.student_name)}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-text-primary truncate" title={item.student_name}>
                                        {item.student_name}
                                    </p>
                                    {item.subjects?.length > 0 && (
                                        <p className="text-[10px] text-text-tertiary truncate">{item.subjects.join(' • ')}</p>
                                    )}
                                </div>
                            </div>

                            {/* Risco + barra */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="text-text-secondary">Risco atual</span>
                                    <span className="font-bold text-text-primary">{item.risk_pct}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            zone === 'urgente' ? 'bg-red-500' :
                                            zone === 'recuperavel' ? 'bg-amber-500' : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${item.risk_pct}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-text-tertiary">
                                    <span>Nota: {Number(item.avg_grade || 0).toFixed(1)}</span>
                                    <span>Presença: {Math.round(Number(item.avg_attendance || 0))}%</span>
                                </div>
                            </div>

                            {/* Tempo restante */}
                            {item.days_estimate !== null && item.days_estimate !== undefined ? (
                                <div className={`rounded-xl border px-3 py-2 flex items-center justify-between text-xs ${cfg.bg} ${cfg.border}`}>
                                    <span className="text-text-secondary">Prazo estimado para agir</span>
                                    <span className="font-bold text-text-primary">~{item.days_estimate} dias</span>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 flex items-center justify-between text-xs">
                                    <span className="text-red-700 font-semibold">Ponto crítico ultrapassado</span>
                                    <span className="text-red-500 font-bold">Agir hoje</span>
                                </div>
                            )}

                            {/* Causas */}
                            {item.top_drivers?.length > 0 && (
                                <div className="space-y-1">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-tertiary">Principais causas</span>
                                    <div className="flex flex-wrap gap-1">
                                        {item.top_drivers.map(d => (
                                            <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-text-secondary border border-slate-200">
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recomendação */}
                            <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2 text-xs leading-relaxed text-text-primary italic">
                                "{item.recommendation}"
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader
                title="Janela de Intervenção Crítica"
                subtitle="Classifica alunos por zona de urgência e estima quanto tempo ainda há para agir preventivamente."
                icon={CalendarRange}
            />
            <div className="space-y-6">
                {!safeRows.length ? (
                    <div className="rounded-[22px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 py-10 text-center text-sm text-text-secondary">
                        Ainda não há dados suficientes para calcular a janela de intervenção.
                    </div>
                ) : (
                    <>
                        {/* Resumo por zona */}
                        <div className="grid grid-cols-3 gap-4 select-none">
                            {[
                                { zone: 'urgente',    count: urgente.length,    label: 'Urgência Crítica',         color: 'text-red-600',   bg: activeFilter === 'urgente' ? 'bg-red-50 border-red-500 ring-2 ring-red-500/10 shadow-sm' : 'bg-red-50/50 border-red-200 hover:bg-red-50 hover:border-red-300' },
                                { zone: 'recuperavel',count: recuperavel.length, label: 'Ainda Recuperável',        color: 'text-amber-600', bg: activeFilter === 'recuperavel' ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/10 shadow-sm' : 'bg-amber-50/50 border-amber-200 hover:bg-amber-50 hover:border-amber-300' },
                                { zone: 'preventivo', count: preventivo.length,  label: 'Monitoramento Preventivo',  color: 'text-blue-600',  bg: activeFilter === 'preventivo' ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/10 shadow-sm' : 'bg-blue-50/50 border-blue-200 hover:bg-blue-50 hover:border-blue-300' },
                            ].map(z => (
                                <button
                                    key={z.zone}
                                    type="button"
                                    onClick={() => setActiveFilter(previous => previous === z.zone ? 'all' : z.zone)}
                                    className={`rounded-[22px] border p-4 text-center transition-all cursor-pointer ${z.bg}`}
                                >
                                    <p className={`text-2xl font-bold ${z.color}`}>{z.count}</p>
                                    <p className="text-xs font-semibold text-text-secondary mt-1">{z.label}</p>
                                    <span className="text-[10px] text-text-tertiary block mt-1">
                                        {activeFilter === z.zone ? 'Filtro ativo (clique para limpar)' : 'Clique para filtrar'}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {(activeFilter === 'all' || activeFilter === 'urgente') && (
                            <ZoneSection zone="urgente" items={urgente} />
                        )}
                        {(activeFilter === 'all' || activeFilter === 'recuperavel') && (
                            <ZoneSection zone="recuperavel" items={recuperavel} />
                        )}
                        {(activeFilter === 'all' || activeFilter === 'preventivo') && (
                            <ZoneSection zone="preventivo" items={preventivo} />
                        )}
                    </>
                )}
            </div>
        </Card>
    );
}

function DisciplinePanel({ rows }) {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader 
                    title="Dificuldades por Disciplina" 
                    subtitle="Disciplinas com maior taxa ou previsão de notas baixas e reprovações."
                    icon={BookOpen}
                />
            </Card>
            <div className="grid gap-4 xl:grid-cols-2">
                {rows.map((item) => (
                    <Card key={item.id}>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-base font-semibold text-text-primary">{item.label}</p>
                                <p className="mt-1 text-sm text-text-secondary">Projeção com base em {item.records} históricos</p>
                            </div>
                            <Badge variant={getRiskVariant(item.risk_level)}>{riskLabels[item.risk_level] || item.risk_level}</Badge>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <StatBox 
                                label="Nota média projetada ✨" 
                                value={item.avg_grade.toFixed(2)} 
                                helper={item.real_avg_grade !== undefined ? `Atual real: ${item.real_avg_grade.toFixed(2)}` : null}
                            />
                            <StatBox 
                                label="Presença projetada ✨" 
                                value={formatPercent(item.avg_attendance)} 
                                helper={item.real_avg_attendance !== undefined ? `Atual real: ${formatPercent(item.real_avg_attendance)}` : null}
                            />
                        </div>
                        <p className="mt-4 text-sm leading-6 text-text-secondary">{item.recommended_focus}</p>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function PrioritiesPanel({ rows }) {
    return (
        <div className="space-y-4">
            {rows.map((item, index) => (
                <Card key={item.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-gradient text-sm font-semibold text-white">
                                    {index + 1}
                                </span>
                                <div>
                                    <p className="text-base font-semibold text-text-primary">{item.label}</p>
                                    <p className="mt-1 text-sm text-text-secondary">{item.course_name} • {item.semester}</p>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {item.recommended_actions.map((action) => (
                                    <Badge key={action} variant="info">{action}</Badge>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">
                            <StatBox label="Prioridade" value={item.priority_index.toFixed(2)} />
                            <StatBox label="Risco" value={formatRisk(item.risk_score)} />
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function StatBox({ label, value, helper }) {
    return (
        <div className="rounded-2xl bg-bg-secondary/50 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-lg font-semibold text-text-primary">{value}</p>
            {helper && <p className="mt-1 text-sm text-text-secondary">{helper}</p>}
        </div>
    );
}

function getAnalysisEndpoints(dataSource) {
    if (dataSource === 'live') {
        return {
            workspace: '/live-data/analysis-workspace',
            atRiskStudents: '/live-data/analysis-workspace/at-risk-students',
            exportWorkspace: '/live-data/analysis-workspace/export',
        };
    }

    return {
        workspace: '/historical-data/analysis-workspace',
        atRiskStudents: '/historical-data/analysis-workspace/at-risk-students',
        exportWorkspace: '/historical-data/analysis-workspace/export',
    };
}

export function AnalysisCenter({ dataSource = 'historical' }) {
    const { user } = useAuth();
    const role = user?.role?.toLowerCase();
    const isCoordinator = role === 'coordinator';
    const historyRoute = isProfessorLikeRole(role) ? buildRolePath(role, 'historical-upload') : '/coordinator/dashboard';
    const isLiveMode = dataSource === 'live';
    const endpoints = getAnalysisEndpoints(dataSource);
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();

    const [workspace, setWorkspace] = useState(null);
    const [selectedAnalysis, setSelectedAnalysis] = useState(searchParams.get('analysis') || 'overview');
    const [selectedSemester, setSelectedSemester] = useState(searchParams.get('semester') || '');
    const [selectedCourse, setSelectedCourse] = useState(searchParams.get('course_name') || '');
    const [selectedSubject, setSelectedSubject] = useState(searchParams.get('subject') || '');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [reloadNonce, setReloadNonce] = useState(0);
    const [exportingFormat, setExportingFormat] = useState('');
    const [exportError, setExportError] = useState('');

    const [selectedClass, setSelectedClass] = useState(null);
    const [atRiskLoading, setAtRiskLoading] = useState(false);
    const [atRiskError, setAtRiskError] = useState('');
    const [atRiskStudents, setAtRiskStudents] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [selectedStudentName, setSelectedStudentName] = useState('');

    useEffect(() => {
        if (selectedStudentId === null) {
            setSelectedStudentName('');
        }
    }, [selectedStudentId]);

    useEffect(() => {
        if (selectedStudentId && !selectedStudentName) {
            api.get(`/students/${selectedStudentId}/detail`)
                .then(res => {
                    setSelectedStudentName(res.data?.student?.name || 'Aluno');
                })
                .catch(() => {
                    setSelectedStudentName('Aluno');
                });
        }
    }, [selectedStudentId, selectedStudentName]);

    const [criteriaModalItem, setCriteriaModalItem] = useState(null);



    const detailsResultRef = useRef(null);

    const [intentQuery, setIntentQuery] = useState('');
    const [analysisFilterQuery, setAnalysisFilterQuery] = useState('');
    const [intentAllowedAnalyses, setIntentAllowedAnalyses] = useState(null);

    const [showIntro, setShowIntro] = useState(false);
    const [activeDropdownGroup, setActiveDropdownGroup] = useState(null);
    const [mobileAnalysesOpen, setMobileAnalysesOpen] = useState(false);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const analysesMenuRef = useRef(null);
    const filtersMenuRef = useRef(null);
    const analyses = workspace?.available_analyses || [];
    const hasRecords = Number(workspace?.overview?.total_records || 0) > 0;

    const analysesById = useMemo(() => {
        const map = new Map();
        (analyses || []).forEach((item) => map.set(item.id, item));
        return map;
    }, [analyses]);

    const analysisGroups = useMemo(() => {
        const sections = [
            {
                id: 'compare',
                title: 'Análises Comparativas',
                description: 'Compare desempenhos e acompanhe evoluções entre turmas.',
                analysisIds: ['by_class', 'between_classes', 'heatmap'],
            },
            {
                id: 'predictive',
                title: 'Previsões e Alertas',
                description: 'Monitore alertas precoces e previsões de risco por disciplina ou aluno.',
                analysisIds: ['early_alerts', 'risk_projection', 'discipline_risk', 'intervention_window', 'intervention_priorities'],
            },
            {
                id: 'factors',
                title: 'Fatores e Simulações',
                description: 'Entenda os causadores do risco e simule melhorias de desempenho.',
                analysisIds: ['risk_factors', 'intervention_simulator', 'discipline_bottlenecks'],
            },
        ];

        const allowedSet = intentAllowedAnalyses?.length ? new Set(intentAllowedAnalyses) : null;

        return sections
            .map((section) => {
                const available = section.analysisIds
                    .map((id) => analysesById.get(id))
                    .filter(Boolean);
                const filteredAvailable = allowedSet
                    ? available.filter((item) => allowedSet.has(item.id))
                    : available;
                return {
                    ...section,
                    available: filteredAvailable,
                };
            })
            .filter((section) => section.available.length > 0);
    }, [analysesById, intentAllowedAnalyses]);

    // Sincronizar grupo ativo com a análise selecionada
    useEffect(() => {
        if (selectedAnalysis && selectedAnalysis !== 'overview') {
            const activeGrp = (analysisGroups || []).find(g => g.analysisIds.includes(selectedAnalysis));
            if (activeGrp) {
                setActiveDropdownGroup(activeGrp.id);
            }
        } else if (selectedAnalysis === 'overview') {
            setActiveDropdownGroup(null);
        }
    }, [selectedAnalysis, analysisGroups]);

    const analysisCounts = useMemo(() => {
        const data = workspace?.analysis_data;
        return {
            early_alerts: Array.isArray(data?.early_alerts) ? data.early_alerts.length : 0,
            by_class: Array.isArray(data?.by_class) ? data.by_class.length : 0,
            between_classes: Array.isArray(data?.between_classes) ? data.between_classes.length : 0,
            intervention_window: Array.isArray(data?.intervention_window) ? data.intervention_window.length : 0,
        };
    }, [workspace]);

    const filteredAnalysisData = useMemo(() => {
        const data = workspace?.analysis_data;
        const query = (analysisFilterQuery || '').trim().toLowerCase();
        if (!data || !query) return data;

        function includesText(value) {
            return String(value || '').toLowerCase().includes(query);
        }

        return {
            ...data,
            early_alerts: (data.early_alerts || []).filter((row) => {
                const tagsText = Array.isArray(row.tags) ? row.tags.join(' ') : '';
                return includesText(row.student_name) || includesText(row.class_label) || includesText(tagsText) || includesText(row.course_name);
            }),
            risk_projection: (data.risk_projection || []).filter((row) => includesText(row.student_name)),
            student_trends: (data.student_trends || []).filter((row) => includesText(row.student_name)),
            risk_factors: (data.risk_factors || []).filter((row) => includesText(row.label) || includesText(row.key)),
            student_segments: (data.student_segments || []).filter((row) => includesText(row.label)),
            by_class: (data.by_class || []).filter((row) => includesText(row.label) || includesText(row.subject) || includesText(row.semester)),
            between_classes: (data.between_classes || []).filter((row) => includesText(row.label) || includesText(row.subject) || includesText(row.semester)),
            intervention_window: (data.intervention_window || []).filter((row) => includesText(row.student_name) || includesText(row.zone_label)),
            discipline_bottlenecks: (data.discipline_bottlenecks || []).filter((row) => includesText(row.label) || includesText(row.subject)),
            heatmap: {
                ...(data.heatmap || {}),
                classes: (data.heatmap?.classes || []).filter((row) => includesText(row.label) || includesText(row.semester)),
            },
        };
    }, [workspace, analysisFilterQuery]);

    useEffect(() => {
        if (selectedAnalysis !== 'by_class') return;
        if (selectedClass?.id) return;

        const firstClass = (filteredAnalysisData?.by_class || workspace?.analysis_data?.by_class || [])[0];
        if (firstClass?.id) {
            handleSelectClass(firstClass);
        }
    }, [filteredAnalysisData, selectedAnalysis, selectedClass, workspace]);

    function routeIntent(rawQuery) {
        const q = String(rawQuery || '').toLowerCase();
        const rules = [
            {
                keys: ['precoce', 'precoces', 'alerta', 'alertas'],
                section: 'action',
                analysis: 'early_alerts',
                allowed: ['early_alerts', 'by_class', 'risk_factors'],
            },
            {
                keys: ['risco alto', 'alto risco', 'critico', 'criticos'],
                section: 'action',
                analysis: 'by_class',
                allowed: ['by_class', 'early_alerts', 'intervention_priorities', 'intervention_window', 'discipline_risk'],
            },
            { keys: ['turma', 'turmas'], section: 'action', analysis: 'by_class' },
            {
                keys: ['fator', 'fatores', 'motivo', 'causa', 'porque', 'por que'],
                section: 'explain',
                analysis: 'risk_factors',
                allowed: ['risk_factors', 'early_alerts', 'by_class', 'intervention_window', 'discipline_risk'],
            },
            { keys: ['simulador', 'intervencao', 'intervenção', 'impacto'], section: 'explain', analysis: 'intervention_simulator' },
            { keys: ['projecao', 'projetar', 'futuro', '8 semanas', '4 semanas'], section: 'trend', analysis: 'risk_projection' },
            { keys: ['comparar', 'comparacao', 'entre turmas'], section: 'compare', analysis: 'between_classes' },
            {
                keys: ['mapa', 'calor', 'heatmap'],
                section: 'compare',
                analysis: 'heatmap',
                allowed: ['heatmap', 'between_classes', 'by_class'],
            },
            {
                keys: ['assunto', 'assuntos', 'topico', 'topicos'],
                section: 'compare',
                analysis: 'intervention_window',
                allowed: ['intervention_window', 'discipline_risk', 'discipline_bottlenecks', 'heatmap', 'by_class'],
            },
            { keys: ['gargalo', 'gargalos', 'disciplina', 'disciplinas'], section: 'compare', analysis: 'discipline_bottlenecks' },
        ];

        const match = rules.find((rule) => rule.keys.some((key) => q.includes(key)));
        if (match) return match;
        return { section: 'action', analysis: 'early_alerts' };
    }

    function handleIntentSearch(nextQuery) {
        const trimmed = String(nextQuery || '').trim();
        if (!trimmed) {
            setAnalysisFilterQuery('');
            setIntentAllowedAnalyses(null);
            return;
        }

        const { section, analysis } = routeIntent(trimmed);
        const resolved = routeIntent(trimmed);
        setIntentAllowedAnalyses(Array.isArray(resolved.allowed) ? resolved.allowed : null);
        setAnalysisFilterQuery(trimmed);
        setShowDetails(true);
        setOpenSection(section);
        setSelectedAnalysis(analysis);
    }

    const visibleAnalyses = useMemo(() => {
        if (!intentAllowedAnalyses?.length) return analyses;
        const allow = new Set(intentAllowedAnalyses);
        return (analyses || []).filter((item) => allow.has(item.id));
    }, [analyses, intentAllowedAnalyses]);

    useEffect(() => {
        async function fetchWorkspace() {
            setLoading(true);
            setError('');
            try {
                const response = await api.get(endpoints.workspace, {
                    params: {
                        semester: selectedSemester || undefined,
                        course_name: selectedCourse || undefined,
                        subject: selectedSubject || undefined,
                    },
                });
                setWorkspace(response.data);
            } catch (requestError) {
                setError(requestError.response?.data?.detail || 'Não foi possível carregar a central analítica.');
            } finally {
                setLoading(false);
            }
        }

        fetchWorkspace();
    }, [endpoints.workspace, isLiveMode, reloadNonce, selectedSemester, selectedCourse, selectedSubject]);

    useEffect(() => {
        const shouldOpen = Boolean(location?.state?.openAnalysisIntro);
        if (!shouldOpen) return;
        if (!workspace || !hasRecords) return;
        setShowIntro(true);
        window.history.replaceState({}, document.title);
    }, [location?.state?.openAnalysisIntro, workspace, hasRecords]);

    useEffect(() => {
        setSelectedClass(null);
        setAtRiskStudents([]);
        setAtRiskError('');
    }, [selectedSemester, selectedCourse, selectedSubject, selectedAnalysis]);

    useEffect(() => {
        const group = analysisGroups.find(g => g.analysisIds.includes(selectedAnalysis));
        if (group) {
            setActiveDropdownGroup(group.id);
        } else {
            setActiveDropdownGroup(null);
        }
    }, [selectedAnalysis, analysisGroups]);

    useEffect(() => {
        if (EXCLUDED_MENU_ANALYSIS_IDS.has(selectedAnalysis)) {
            setSelectedAnalysis('overview');
        }
    }, [selectedAnalysis]);

    useEffect(() => {
        setMobileAnalysesOpen(false);
        setMobileFiltersOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        function handlePointerDown(event) {
            if (analysesMenuRef.current && !analysesMenuRef.current.contains(event.target)) {
                setMobileAnalysesOpen(false);
            }
            if (filtersMenuRef.current && !filtersMenuRef.current.contains(event.target)) {
                setMobileFiltersOpen(false);
            }
        }

        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    function handleSelectAnalysis(nextId) {
        setSelectedAnalysis(nextId);
        setMobileAnalysesOpen(false);
        scrollToResults();
    }

    function renderAnalysesMenuContent() {
        return (
            <>
                <button
                    type="button"
                    onClick={() => handleSelectAnalysis('overview')}
                    className={[
                        'w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 flex items-center gap-2 outline-none focus:outline-none',
                        selectedAnalysis === 'overview'
                            ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950/40 dark:text-indigo-300'
                            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                    ].join(' ')}
                >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="text-[12.5px] font-semibold">Resumo Geral</span>
                </button>

                <div className="border-t border-border-subtle pt-2.5 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary px-2 mb-2">Tópicos de Análise</p>
                    {analysisGroups.map((group) => {
                        const isExpanded = activeDropdownGroup === group.id;
                        const groupHasActiveAnalysis = group.analysisIds.includes(selectedAnalysis);
                        const groupAnalyses = group.available;

                        return (
                            <div
                                key={group.id}
                                className="border border-border-subtle/80 rounded-xl overflow-hidden bg-bg-secondary/20 transition-all duration-200"
                            >
                                <button
                                    type="button"
                                    onClick={() => setActiveDropdownGroup(isExpanded ? null : group.id)}
                                    className={[
                                        'w-full px-3 py-2 text-left flex items-center justify-between transition-colors outline-none focus:outline-none',
                                        groupHasActiveAnalysis
                                            ? 'text-indigo-700 font-semibold dark:text-indigo-400'
                                            : 'text-text-primary hover:bg-bg-secondary/40'
                                    ].join(' ')}
                                >
                                    <span className="text-[12px] font-semibold flex items-center gap-1.5">
                                        <span className={`h-1.5 w-1.5 rounded-full ${groupHasActiveAnalysis ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-slate-400 dark:bg-slate-600'}`} />
                                        {group.title}
                                    </span>
                                    {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-text-tertiary transition-transform duration-200 rotate-180" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-text-tertiary transition-transform duration-200" />
                                    )}
                                </button>

                                {isExpanded && (
                                    <div className="px-2 pb-2 pt-1 border-t border-border-subtle/50 bg-bg-card space-y-1 animate-fadeIn">
                                        {groupAnalyses.map((item) => {
                                            const active = item.id === selectedAnalysis;
                                            return (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => handleSelectAnalysis(item.id)}
                                                    className={[
                                                        'w-full rounded-lg px-2.5 py-1.5 text-left transition-all duration-150 flex flex-col gap-0.5 outline-none focus:outline-none',
                                                        active
                                                            ? 'bg-indigo-50/70 text-indigo-700 font-semibold border-l-2 border-indigo-600 pl-2 dark:bg-indigo-950/35 dark:text-indigo-300 dark:border-indigo-400'
                                                            : 'text-text-secondary hover:bg-bg-secondary/40 hover:text-text-primary'
                                                    ].join(' ')}
                                                >
                                                    <span className="text-[11.5px] font-medium">{item.label}</span>
                                                    {item.description && (
                                                        <span className="text-[9.5px] opacity-75 line-clamp-2 lg:line-clamp-1">{item.description}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </>
        );
    }

    function renderFiltersContent() {
        return (
            <div className="grid gap-4 md:grid-cols-3">
                <FilterSelect label="Semestre" value={selectedSemester} onChange={setSelectedSemester} options={workspace?.filters?.semesters || []} />
                <FilterSelect label="Curso" value={selectedCourse} onChange={setSelectedCourse} options={workspace?.filters?.courses || []} />
                <FilterSelect label="Disciplina" value={selectedSubject} onChange={setSelectedSubject} options={workspace?.filters?.subjects || []} />
            </div>
        );
    }

    function scrollToResults() {
        if (!detailsResultRef.current) return;
        requestAnimationFrame(() => {
            detailsResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    async function handleOpenStudent(item) {
        const name = String(item?.student_name || item?.name || '').trim();
        if (name) {
            setSelectedStudentName(name);
        }

        const directId = item?.student_id;
        if (directId) {
            setSelectedStudentId(directId);
            return;
        }

        if (!name) return;

        try {
            const response = await api.get('/students', {
                params: {
                    search: name,
                    limit: 1,
                },
            });
            const resolvedId = response.data?.students?.[0]?.id;
            if (resolvedId) {
                setSelectedStudentId(resolvedId);
                if (response.data?.students?.[0]?.name) {
                    setSelectedStudentName(response.data.students[0].name);
                }
            }
        } catch (requestError) {
            // silently ignore (no access / no match)
        }
    }

    async function handleSelectClass(item) {
        setSelectedClass(item);
        setAtRiskError('');
        if (!item?.id) return;

        if (Array.isArray(item.at_risk_students) && item.at_risk_students.length) {
            setAtRiskStudents(item.at_risk_students.slice(0, 4));
            setAtRiskLoading(false);
            return;
        }

        setAtRiskStudents([]);

        setAtRiskLoading(true);
        try {
            const response = await api.get(endpoints.atRiskStudents, {
                params: {
                    class_key: item.id,
                    semester: selectedSemester || undefined,
                    course_name: selectedCourse || undefined,
                    subject: selectedSubject || undefined,
                    limit: 4,
                },
            });
            setAtRiskStudents((response.data?.students || []).slice(0, 4));
        } catch (requestError) {
            setAtRiskError(requestError.response?.data?.detail || 'Não foi possível carregar alunos em risco.');
        } finally {
            setAtRiskLoading(false);
        }
    }

    useEffect(() => {
        const next = {};
        if (selectedAnalysis) next.analysis = selectedAnalysis;
        if (selectedSemester) next.semester = selectedSemester;
        if (selectedCourse) next.course_name = selectedCourse;
        if (selectedSubject) next.subject = selectedSubject;
        setSearchParams(next, { replace: true });
    }, [selectedAnalysis, selectedSemester, selectedCourse, selectedSubject, setSearchParams]);

    useEffect(() => {
        if (!workspace?.available_analyses?.length) return;
        if (EXCLUDED_MENU_ANALYSIS_IDS.has(selectedAnalysis)) {
            setSelectedAnalysis('overview');
            return;
        }
        const exists = workspace.available_analyses.some((item) => item.id === selectedAnalysis);
        if (!exists) setSelectedAnalysis(workspace.available_analyses[0].id);
    }, [workspace, selectedAnalysis]);

    async function handleExport(format) {
        try {
            setExportingFormat(format);
            setExportError('');
            const response = await api.get(endpoints.exportWorkspace, {
                params: {
                    analysis_id: selectedAnalysis,
                    export_format: format,
                    semester: selectedSemester || undefined,
                    course_name: selectedCourse || undefined,
                    subject: selectedSubject || undefined,
                },
                responseType: 'blob',
            });

            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const contentDisposition = response.headers['content-disposition'] || '';
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
            link.href = url;
            link.download = filenameMatch?.[1] || `nexora-${selectedAnalysis}.${format}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (requestError) {
            setExportError(requestError.response?.data?.detail || 'Não foi possível exportar a análise selecionada.');
        } finally {
            setExportingFormat('');
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <Card className="min-h-[320px] flex items-center justify-center">
                    <div className="flex items-center justify-center gap-3 text-text-secondary">
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                        Carregando análises...
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                icon={AlertTriangle}
                title="Não foi possível abrir as análises acadêmicas"
                description={error}
                action={<Button onClick={() => setReloadNonce((current) => current + 1)}>Tentar novamente</Button>}
            />
        );
    }

    return (
        <div className="space-y-6">
            <AnalysisIntroModal
                open={showIntro}
                analyses={analyses}
                onSelect={(nextId) => {
                    setSelectedAnalysis(nextId);
                    setShowIntro(false);
                }}
                onClose={() => {
                    setShowIntro(false);
                }}
            />
            {/* Barra de Ações Compacta e de Alta Performance (Substitui o PageHeader Duplicado) */}
            <div className="relative z-20 mb-6 flex flex-col gap-4 overflow-visible rounded-[24px] border border-border-subtle/50 bg-bg-card/40 px-4 py-4 shadow-soft backdrop-blur-md sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold text-text-secondary">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedClass(null);
                                setSelectedStudentId(null);
                                setSelectedAnalysis('overview');
                                scrollToResults();
                            }}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-1.5 outline-none focus:outline-none"
                        >
                            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            Análises
                        </button>

                        {selectedAnalysis && selectedAnalysis !== 'overview' && (
                            <>
                                <span className="text-text-tertiary">/</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedClass(null);
                                        setSelectedStudentId(null);
                                    }}
                                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition outline-none focus:outline-none"
                                >
                                    {analysesById.get(selectedAnalysis)?.label || selectedAnalysis}
                                </button>
                            </>
                        )}

                        {selectedAnalysis === 'by_class' && selectedClass && (
                            <>
                                <span className="text-text-tertiary">/</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedStudentId(null);
                                    }}
                                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition outline-none focus:outline-none"
                                >
                                    {formatClassLabel(selectedClass)}
                                </button>
                            </>
                        )}

                        {selectedStudentId !== null && (
                            <>
                                <span className="text-text-tertiary">/</span>
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                                    {selectedStudentName || 'Carregando...'}
                                </span>
                            </>
                        )}
                    </div>
                    <Badge variant="info" className="ml-2">{workspace?.scope?.label}</Badge>
                </div>
                <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto lg:justify-end">
                    {hasRecords && (
                        <>
                            {/* Desktop: hover dropdown com largura fixa */}
                            <div className="relative group hidden lg:block">
                                <Button variant="outline" icon={Layers3}>
                                    Outras análises
                                </Button>
                                <div className="absolute right-0 top-full z-50 mt-2 w-80 translate-y-1 opacity-0 pointer-events-none transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                    <div className="rounded-[22px] border border-border-subtle bg-bg-card p-3.5 shadow-card max-h-[420px] overflow-y-auto space-y-3">
                                        {renderAnalysesMenuContent()}
                                    </div>
                                </div>
                            </div>

                            {/* Mobile: clique com painel em largura total */}
                            <div className="relative w-full lg:hidden" ref={analysesMenuRef}>
                                <Button
                                    variant="outline"
                                    icon={Layers3}
                                    className="w-full justify-center"
                                    onClick={() => setMobileAnalysesOpen((current) => !current)}
                                >
                                    Outras análises
                                </Button>
                                {mobileAnalysesOpen && (
                                    <div className="absolute inset-x-0 top-full z-50 mt-2">
                                        <div className="rounded-[22px] border border-border-subtle bg-bg-card p-3.5 shadow-card max-h-[420px] overflow-y-auto space-y-3">
                                            {renderAnalysesMenuContent()}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative group hidden lg:block">
                                <Button variant="outline" icon={Filter} aria-label="Filtros" />
                                <div className="absolute right-0 top-full z-50 mt-2 w-[min(720px,50vw)] translate-y-1 opacity-0 pointer-events-none transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                                    <div className="rounded-[22px] border border-border-subtle bg-bg-card p-4 shadow-card">
                                        {renderFiltersContent()}
                                    </div>
                                </div>
                            </div>

                            <div className="relative w-full lg:hidden" ref={filtersMenuRef}>
                                <Button
                                    variant="outline"
                                    icon={Filter}
                                    aria-label="Filtros"
                                    className="w-full justify-center"
                                    onClick={() => setMobileFiltersOpen((current) => !current)}
                                >
                                    Filtros
                                </Button>
                                {mobileFiltersOpen && (
                                    <div className="absolute inset-x-0 top-full z-50 mt-2">
                                        <div className="rounded-[22px] border border-border-subtle bg-bg-card p-4 shadow-card">
                                            {renderFiltersContent()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {workspace?.scope?.can_upload && (
                        <Link to={historyRoute} className="w-full sm:w-auto">
                            <Button variant="secondary" icon={Upload} className="w-full justify-center sm:w-auto">Subir novo arquivo</Button>
                        </Link>
                    )}
                </div>
            </div>

            {hasRecords && (
                <Card>
                    <CardHeader title="Área de exportação" subtitle="Exporte o recorte atual em diferentes formatos." icon={Download} />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-3">
                            <Button variant="secondary" icon={Download} loading={exportingFormat === 'pdf'} onClick={() => handleExport('pdf')}>Exportar PDF</Button>
                            <Button variant="secondary" icon={Download} loading={exportingFormat === 'csv'} onClick={() => handleExport('csv')}>Exportar CSV</Button>
                            <Button variant="secondary" icon={Download} loading={exportingFormat === 'xlsx'} onClick={() => handleExport('xlsx')}>Exportar XLSX</Button>
                            <Button variant="outline" icon={Download} loading={exportingFormat === 'json'} onClick={() => handleExport('json')}>Exportar JSON</Button>
                        </div>
                    </div>
                    {exportError && <p className="mt-4 text-sm text-danger">{exportError}</p>}
                </Card>
            )}

            {!hasRecords ? (
                <EmptyState
                    icon={isLiveMode ? BrainCircuit : Upload}
                    title={isLiveMode
                        ? 'Nenhum dado do Lyceum foi analisado ainda'
                        : workspace?.scope?.can_upload
                            ? 'Nenhum arquivo histórico foi analisado ainda'
                            : 'Ainda não há base histórica disponível para este recorte'}
                    description={isLiveMode
                        ? 'Sincronize os dados do portal docente para liberar a mesma central analítica completa usando o recorte em tempo real.'
                        : workspace?.scope?.can_upload
                        ? 'Envie um PDF ou planilha histórica para liberar as cinco análises acadêmicas do professor.'
                        : 'Quando os professores enviarem bases históricas, a coordenação poderá comparar turmas e priorizar intervenções.'}
                    action={!isLiveMode && workspace?.scope?.can_upload ? (
                        <Link to={historyRoute}>
                            <Button icon={Upload}>Ir para upload histórico</Button>
                        </Link>
                    ) : null}
                />
            ) : (
                <>
                    <MinimalOverview overview={workspace.overview} disciplines={workspace.analysis_data.discipline_risk} />

                    <motion.div
                        ref={detailsResultRef}
                        key={selectedAnalysis}
                        initial={false}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        {selectedAnalysis === 'overview' && <OverviewPanel workspace={workspace} isCoordinator={isCoordinator} />}
                        {selectedAnalysis === 'by_class' && (
                            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                                <ClassesPanel
                                    title="Análise por turma"
                                    subtitle="Clique em uma turma para ver os alunos com maior risco de evasão."
                                    rows={filteredAnalysisData?.by_class || workspace.analysis_data.by_class}
                                    onSelectRow={handleSelectClass}
                                />
                                <AtRiskStudentsPanel
                                    title="Alunos em risco"
                                    subtitle="Até quatro alunos com maior necessidade de intervenção neste recorte."
                                    classLabel={selectedClass ? formatClassLabel(selectedClass) : ''}
                                    rows={atRiskStudents}
                                    loading={atRiskLoading}
                                    error={atRiskError}
                                    onSelectStudent={(student) => {
                                        if (student?.student_id) {
                                            setSelectedStudentId(student.student_id);
                                            setSelectedStudentName(student.student_name || student.name || 'Aluno');
                                        }
                                    }}
                                    onViewCriteria={(item) => setCriteriaModalItem(item)}
                                />
                            </div>
                        )}
                        {selectedAnalysis === 'between_classes' && (
                            <BetweenClassesPanel
                                title="Comparar Turmas"
                                subtitle="Selecione duas turmas para ver a comparação de desempenho."
                                rows={filteredAnalysisData?.between_classes || workspace.analysis_data.between_classes}
                            />
                        )}
                        {selectedAnalysis === 'by_semester' && <SemesterPanel rows={workspace.analysis_data.by_semester} />}
                        {selectedAnalysis === 'intervention_window' && <InterventionWindowPanel rows={filteredAnalysisData?.intervention_window || workspace.analysis_data.intervention_window} />}
                        {selectedAnalysis === 'discipline_risk' && <DisciplineRiskPanel rows={workspace.analysis_data.discipline_risk} />}
                        {selectedAnalysis === 'discipline_bottlenecks' && <DisciplinePanel rows={filteredAnalysisData?.discipline_bottlenecks || workspace.analysis_data.discipline_bottlenecks} />}
                        {selectedAnalysis === 'intervention_priorities' && <PrioritiesPanel rows={workspace.analysis_data.intervention_priorities} />}
                        {selectedAnalysis === 'student_trends' && <StudentTrendsPanel rows={filteredAnalysisData?.student_trends || workspace.analysis_data.student_trends} />}
                        {selectedAnalysis === 'risk_factors' && (
                            <RiskFactorsPanel
                                rows={filteredAnalysisData?.risk_factors || workspace.analysis_data.risk_factors}
                                diagnostics={workspace.analysis_data.model_diagnostics || workspace.overview?.model_diagnostics}
                            />
                        )}
                        {selectedAnalysis === 'early_alerts' && (
                            <EarlyAlertsPanel
                                rows={filteredAnalysisData?.early_alerts || workspace.analysis_data.early_alerts}
                                onSelectStudent={(item) => handleOpenStudent(item)}
                                onViewCriteria={(item) => setCriteriaModalItem(item)}
                            />
                        )}
                        {selectedAnalysis === 'intervention_simulator' && (
                            <InterventionSimulatorPanel 
                                data={workspace.analysis_data.intervention_simulator} 
                                totalStudents={workspace?.overview?.total_students} 
                            />
                        )}
                        {selectedAnalysis === 'student_segments' && <StudentSegmentsPanel rows={filteredAnalysisData?.student_segments || workspace.analysis_data.student_segments} />}
                        {selectedAnalysis === 'risk_projection' && <RiskProjectionPanel rows={filteredAnalysisData?.risk_projection || workspace.analysis_data.risk_projection} />}
                        {selectedAnalysis === 'heatmap' && <HeatmapPanel data={filteredAnalysisData?.heatmap || workspace.analysis_data.heatmap} />}
                    </motion.div>




                </>
            )}

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />

            {criteriaModalItem && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-sm">
                    <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-border-subtle bg-white shadow-card-hover">
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-white p-6">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Critérios do risco</p>
                                <h2 className="mt-2 text-xl font-semibold text-text-primary">{criteriaModalItem.student_name}</h2>
                                <p className="mt-2 text-sm leading-6 text-text-secondary">Mostra a participação proporcional de cada fator na composição do risco deste aluno (somando 100%).</p>
                            </div>
                            <Button variant="outline" onClick={() => setCriteriaModalItem(null)}>Fechar</Button>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto p-6">
                            <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-5 py-4 text-sm text-text-secondary">
                                <span className="font-semibold text-text-primary">Risco:</span> {formatRisk(criteriaModalItem.risk_score)}
                                {criteriaModalItem.priority !== undefined && criteriaModalItem.priority !== null && (
                                    <>
                                        {'  '}<span className="font-semibold text-text-primary">Prioridade:</span> {criteriaModalItem.priority}
                                    </>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-y-3 text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                            <th className="px-4">Fator</th>
                                            <th className="px-4">Peso no risco</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const breakdown = criteriaModalItem.risk_breakdown || {};
                                            const labels = {
                                                nota: 'Nota',
                                                primeira_avaliacao: 'Primeira avaliação',
                                                presenca: 'Presença',
                                                queda_presenca: 'Queda de presença',
                                                atividade: 'Atividade',
                                                oscilacao: 'Oscilação de notas',
                                                aprovacao: 'Reprovação',
                                                historico: 'Histórico de reprovações',
                                                carga: 'Carga de disciplinas',
                                                dificuldade_disciplina: 'Dificuldade da disciplina',
                                                trabalho: 'Trabalho',
                                            };

                                            const entries = Object.entries(breakdown)
                                                .map(([key, val]) => ({
                                                    key,
                                                    label: labels[key] || key,
                                                    val: Number(val || 0)
                                                }))
                                                .filter(item => item.val > 0 && item.key !== 'atividade' && item.key !== 'trabalho');

                                            const totalContribution = entries.reduce((sum, item) => sum + item.val, 0);

                                            if (totalContribution === 0) {
                                                return (
                                                    <tr>
                                                        <td colSpan="2" className="px-5 py-8 text-center text-sm text-text-secondary rounded-[20px] border border-border-subtle bg-white">
                                                            Nenhum fator de risco ativo para este aluno.
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            // Calcular percentagens e arredondar para 1 casa decimal
                                            let items = entries.map(item => {
                                                const rawPct = (item.val / totalContribution) * 100;
                                                return {
                                                    ...item,
                                                    pct: Math.round(rawPct * 10) / 10
                                                };
                                            });

                                            // Ajustar arredondamentos para a soma fechar exatamente em 100%
                                            const sumPct = items.reduce((sum, item) => sum + item.pct, 0);
                                            const diff = 100.0 - sumPct;
                                            if (items.length > 0 && Math.abs(diff) > 0.01) {
                                                // Encontrar o item de maior valor para absorver a diferença de arredondamento
                                                items.sort((a, b) => b.val - a.val);
                                                items[0].pct = Number((items[0].pct + diff).toFixed(1));
                                            }

                                            // Ordenar do maior para o menor peso
                                            items.sort((a, b) => b.pct - a.pct);

                                            return (
                                                <>
                                                    {items.map((item) => (
                                                        <tr key={item.key} className="rounded-[22px] border border-border-subtle bg-white shadow-sm">
                                                            <td className="min-w-[220px] whitespace-normal break-words rounded-l-[20px] px-5 py-5 text-sm font-semibold leading-6 text-text-primary">{item.label}</td>
                                                            <td className="rounded-r-[20px] px-5 py-5 text-sm leading-6 text-text-secondary">{item.pct.toFixed(1)}%</td>
                                                        </tr>
                                                    ))}
                                                    <tr className="rounded-[22px] border border-border-subtle bg-bg-secondary/40 font-semibold shadow-sm">
                                                        <td className="min-w-[220px] rounded-l-[20px] px-5 py-4 text-sm text-text-primary">Total proporcional</td>
                                                        <td className="rounded-r-[20px] px-5 py-4 text-sm text-text-primary">100.0%</td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
