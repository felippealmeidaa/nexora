import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Award,
    BookOpen,
    CalendarRange,
    CheckCircle2,
    Clock,
    GraduationCap,
    ShieldAlert,
    Sparkles,
    TrendingUp,
    User,
    X,
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
} from 'recharts';
import api from '@/services/api';
import { Badge } from '@/components/ui/Badge';

const TAB_ITEMS = [
    { id: 'overview', label: 'Visão geral', icon: TrendingUp },
    { id: 'grades', label: 'Notas', icon: Award },
    { id: 'attendance', label: 'Frequência', icon: Clock },
    { id: 'preventive', label: 'Ações Preventivas ✨', icon: Sparkles },
    { id: 'subjects', label: 'Disciplinas', icon: BookOpen },
    { id: 'schedule', label: 'Horários', icon: CalendarRange },
];

const priorityLabels = {
    critical: 'Crítico',
    high: 'Alto',
    medium: 'Médio',
    low: 'Baixo'
};

export function StudentDetailModal({ studentId, isOpen, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        if (isOpen && studentId) {
            setLoading(true);
            setError('');
            setActiveTab('overview');
            api.get(`/students/${studentId}/detail`)
                .then((response) => setData(response.data))
                .catch((requestError) => {
                    console.error('Erro ao buscar detalhes do aluno', requestError);
                    setError(requestError.response?.data?.detail || 'Não foi possível carregar os dados do aluno.');
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, studentId]);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const analytics = data?.analytics || {};
    const kpis = analytics?.kpis || {};
    const grades = data?.grades || [];
    const attendance = data?.attendance || [];
    const subjects = data?.subjects || [];
    const schedule = data?.schedule || [];
    const recommendations = analytics?.recommendations || [];
    const history = analytics?.history || [];

    const headerStats = {
        subjects: grades.length || subjects.length || 0,
        avgGrade: Number(kpis.gpa || 0).toFixed(1),
        avgAttendance: `${Number(kpis.attendance_rate || 0).toFixed(0)}%`,
        riskScore: `${Math.round(Number(kpis.risk_score || 0) * 100)}%`,
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="fixed inset-0 z-[100] bg-slate-950/28 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    <motion.div
                        className="fixed right-0 top-0 z-[101] flex h-full w-full max-w-[960px] flex-col border-l border-border-subtle bg-white shadow-card-hover"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                    >
                        <div className="border-b border-border-subtle bg-brand-gradient-soft px-6 py-6">
                            {loading ? (
                                <div className="space-y-3">
                                    <div className="h-5 w-48 animate-pulse rounded-full bg-white/60" />
                                    <div className="h-4 w-32 animate-pulse rounded-full bg-white/50" />
                                </div>
                            ) : data && (
                                <div className="space-y-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand-gradient text-lg font-bold text-white">
                                                {getInitials(data.student.name)}
                                            </div>
                                            <div>
                                                <h2 className="text-xl font-semibold text-text-primary">{data.student.name}</h2>
                                                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                                                    <span>{data.student.registration_number}</span>
                                                    <span>{data.student.course_name || '--'}</span>
                                                    <span>{data.student.current_period ? `${data.student.current_period}º período` : 'Período não informado'}</span>
                                                </div>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <Badge variant={getRiskBadgeVariant(kpis.risk_level)} dot>
                                                        {formatRiskLabel(kpis.risk_level)}
                                                    </Badge>
                                                    <Badge variant="info">
                                                        {data.student.class_schedule === 'MORNING' ? 'Matutino' : data.student.class_schedule === 'NIGHT' ? 'Noturno' : data.student.class_schedule === 'INTEGRAL' ? 'Integral' : (data.student.class_schedule || 'Turno não informado')}
                                                    </Badge>
                                                    <Badge variant={data.student.sync_status === 'done' ? 'success' : data.student.sync_status === 'error' ? 'danger' : 'neutral'}>
                                                        Sincronização: {data.student.sync_status === 'done' ? 'Concluída' : data.student.sync_status === 'error' ? 'Erro' : 'Indisponível'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-subtle bg-white text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                                        <QuickStat label="Disciplinas" value={headerStats.subjects} icon={BookOpen} />
                                        <QuickStat label="Média geral" value={headerStats.avgGrade} icon={TrendingUp} />
                                        <QuickStat label="Frequência" value={headerStats.avgAttendance} icon={Clock} />
                                        <QuickStat label="Risco" value={headerStats.riskScore} icon={ShieldAlert} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-b border-border-subtle px-6 pt-4">
                            <div className="flex flex-wrap gap-2">
                                {TAB_ITEMS.map((tab) => (
                                    <TabButton
                                        key={tab.id}
                                        active={activeTab === tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        icon={tab.icon}
                                        label={tab.label}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            {loading ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 4 }).map((_, index) => (
                                        <div key={index} className="h-24 animate-pulse rounded-[22px] bg-bg-secondary" />
                                    ))}
                                </div>
                            ) : error ? (
                                <EmptyPanel icon={ShieldAlert} title="Não foi possível abrir o aluno" description={error} />
                            ) : (
                                <>
                                    {activeTab === 'overview' && (
                                        <OverviewTab
                                            student={data?.student}
                                            kpis={kpis}
                                            history={history}
                                            recommendations={recommendations}
                                            grades={grades}
                                        />
                                    )}
                                    {activeTab === 'grades' && <GradesTab grades={grades} />}
                                    {activeTab === 'attendance' && <AttendanceTab attendance={attendance} />}
                                    {activeTab === 'preventive' && (
                                        <PreventiveTab
                                            studentId={studentId}
                                            studentName={data?.student?.name}
                                        />
                                    )}
                                    {activeTab === 'subjects' && <SubjectsTab subjects={subjects} />}
                                    {activeTab === 'schedule' && <ScheduleTab schedule={schedule} />}
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function QuickStat({ label, value, icon: Icon }) {
    return (
        <div className="rounded-[20px] border border-border-subtle bg-white/78 p-4">
            <div className="flex items-center gap-2 text-text-secondary">
                <Icon className="h-4 w-4 text-accent-blue" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
            </div>
            <p className="mt-3 text-2xl font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                active ? 'border-b-2 border-accent-blue text-accent-blue' : 'text-text-secondary hover:text-text-primary'
            }`}
        >
            <Icon className="h-4 w-4" />
            {label}
        </button>
    );
}

function OverviewTab({ student, kpis, history, recommendations, grades = [] }) {
    // Filtrar disciplinas que possuem notas válidas
    const validGrades = grades.filter(g => g.va1 !== null || g.va2 !== null || g.va3 !== null);
    
    // Estado local para a disciplina selecionada no gráfico
    const [selectedCourse, setSelectedCourse] = useState('');

    // Se o estado estiver vazio mas validGrades tiver itens, selecionamos o primeiro
    useEffect(() => {
        if (!selectedCourse && validGrades.length > 0) {
            setSelectedCourse(validGrades[0].disciplina);
        }
    }, [validGrades, selectedCourse]);

    const activeGrade = validGrades.find(g => g.disciplina === selectedCourse);

    // Lógica para montar os dados do gráfico
    let realData = [];
    let projData = [];
    let isProjectedDiscipline = false;

    if (activeGrade) {
        isProjectedDiscipline = !!activeGrade.is_projected;
        const va1 = activeGrade.va1 != null ? Number(activeGrade.va1) : null;
        const va2 = activeGrade.va2 != null ? Number(activeGrade.va2) : null;
        const va3 = activeGrade.va3 != null ? Number(activeGrade.va3) : null;

        const va2_proj = !!activeGrade.va2_projected;
        const va3_proj = !!activeGrade.va3_projected;

        // Montar Real
        if (va1 !== null) {
            realData.push({ name: 'VA1', nota: va1 });
        }
        if (va2 !== null && !va2_proj) {
            realData.push({ name: 'VA2', nota: va2 });
        }
        if (va3 !== null && !va3_proj) {
            realData.push({ name: 'VA3', nota: va3 });
        }

        // Montar Projetado
        if (va2_proj && va2 !== null) {
            if (va1 !== null) {
                projData.push({ name: 'VA1', nota: va1 });
            }
            projData.push({ name: 'P2', nota: va2 });
            if (va3 !== null) {
                projData.push({ name: 'P3', nota: va3 });
            }
        } else if (va3_proj && va3 !== null) {
            if (va2 !== null) {
                projData.push({ name: 'VA2', nota: va2 });
            } else if (va1 !== null) {
                projData.push({ name: 'VA1', nota: va1 });
            }
            projData.push({ name: 'P3', nota: va3 });
        }
    }

    const lastRealName = realData.length > 0 ? realData[realData.length - 1].name : null;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0];
            const name = dataPoint.name === 'Real' ? 'Nota Real' : 'Nota Projetada ✨';
            return (
                <div className="rounded-xl border border-border-subtle bg-white p-3 shadow-lg">
                    <p className="text-xs font-semibold text-text-secondary">{dataPoint.payload.name}</p>
                    <p className="mt-1 text-sm font-bold text-text-primary">
                        {name}: <span className={getGradeColorClass(dataPoint.value)}>{dataPoint.value.toFixed(1)}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-accent-blue" />
                        <p className="text-sm font-semibold text-text-primary">Dados do aluno</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <InfoLine icon={User} label="Matrícula" value={student?.registration_number} />
                        <InfoLine icon={GraduationCap} label="Curso" value={student?.course_name} />
                        <InfoLine icon={CalendarRange} label="Período atual" value={student?.current_period ? `${student.current_period}º período` : '--'} />
                        <InfoLine icon={Clock} label="Turno" value={student?.class_schedule === 'MORNING' ? 'Matutino' : student?.class_schedule === 'NIGHT' ? 'Noturno' : student?.class_schedule === 'INTEGRAL' ? 'Integral' : (student?.class_schedule || '--')} />
                        <InfoLine icon={CalendarRange} label="Ingresso" value={formatDate(student?.enrollment_date)} />
                        <InfoLine icon={CheckCircle2} label="Status" value={student?.status === 'ACTIVE' ? 'Ativo' : student?.status === 'INACTIVE' ? 'Inativo' : (student?.status || '--')} />
                        <InfoLine
                            icon={ShieldAlert}
                            label="Trabalho"
                            value={student?.is_working ? (student?.work_schedule ? `Sim • ${student.work_schedule}` : 'Sim') : 'Não'}
                        />
                    </div>
                </div>

                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-accent-purple" />
                        <p className="text-sm font-semibold text-text-primary">Indicadores estatísticos</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MetricMini label="GPA" value={Number(kpis.gpa || 0).toFixed(2)} />
                        <MetricMini label="Frequência" value={`${Number(kpis.attendance_rate || 0).toFixed(0)}%`} />
                        <MetricMini label="Reprovações" value={kpis.failures ?? 0} />
                        <MetricMini label="Tendência" value={formatTrend(kpis.grade_trend)} />
                    </div>
                </div>
            </div>

            {/* Nova Seção: Trajetória de Notas Projetada */}
            {validGrades.length > 0 && (
                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-indigo-600" />
                            <p className="text-sm font-semibold text-text-primary">
                                Trajetória Acadêmica Projetada {isProjectedDiscipline ? '✨' : ''}
                            </p>
                        </div>
                        <select
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            className="rounded-xl border border-border-subtle bg-white px-3 py-1.5 text-xs font-semibold text-text-primary shadow-sm outline-none focus:border-indigo-400 transition"
                        >
                            {validGrades.map((g) => (
                                <option key={g.disciplina} value={g.disciplina}>
                                    {g.disciplina} {g.is_projected ? '✨' : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mt-6 h-[220px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} cursor={false} />
                                {lastRealName && projData.length > 0 && (
                                    <ReferenceLine 
                                        x={lastRealName} 
                                        stroke="#8b5cf6" 
                                        strokeWidth={1.5} 
                                        strokeDasharray="4 4"
                                        label={{ 
                                            value: 'Transição Real ➔ Projeção (IA) 🔮', 
                                            position: 'insideTopLeft', 
                                            fill: '#8b5cf6', 
                                            fontSize: 9,
                                            fontWeight: 'bold',
                                            offset: 8
                                        }} 
                                    />
                                )}
                                <Line
                                    type="monotone"
                                    data={realData}
                                    dataKey="nota"
                                    stroke="#0ea5e9"
                                    strokeWidth={3}
                                    dot={{ stroke: '#0ea5e9', strokeWidth: 2, fill: '#fff', r: 4 }}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }}
                                    name="Real"
                                    connectNulls
                                />
                                {projData.length > 0 && (
                                    <Line
                                        type="monotone"
                                        data={projData}
                                        dataKey="nota"
                                        stroke="#8b5cf6"
                                        strokeWidth={3}
                                        strokeDasharray="6 6"
                                        dot={{ stroke: '#8b5cf6', strokeWidth: 2, fill: '#fff', r: 4 }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }}
                                        name="Projetado ✨"
                                        connectNulls
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    {isProjectedDiscipline && (
                        <p className="mt-3 text-[11px] text-text-secondary leading-5 italic flex items-center gap-1">
                            <span>✨ Linha pontilhada indica projeção preditiva gerada pela inteligência matemática do NEXORA.</span>
                        </p>
                    )}
                </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-accent-blue" />
                        <p className="text-sm font-semibold text-text-primary">Histórico sintético</p>
                    </div>
                    {history?.length ? (
                        <div className="mt-4 space-y-3">
                            {history.map((item) => (
                                <div key={`${item.disciplina}-${item.media}`} className="rounded-2xl bg-white px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                                            <p className="mt-1 text-sm text-text-secondary">{item.situacao || 'Em andamento'}</p>
                                        </div>
                                        <span className={getGradeColorClass(item.media)}>
                                            {Number(item.media || 0).toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyInline text="Nenhum histórico de notas encontrado." />
                    )}
                </div>

                <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-accent-purple" />
                        <p className="text-sm font-semibold text-text-primary">Recomendações acadêmicas</p>
                    </div>
                    {recommendations?.length ? (
                        <div className="mt-4 space-y-3">
                            {recommendations.map((item, index) => (
                                <div key={`${item.title}-${index}`} className="rounded-2xl bg-white px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={mapPriorityToBadge(item.priority)}>
                                            {priorityLabels[item.priority] || item.priority || 'Prioridade'}
                                        </Badge>
                                        <p className="text-sm font-semibold text-text-primary">{item.title}</p>
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-text-secondary">{item.message}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyInline text="Sem recomendações adicionais para este aluno no momento." />
                    )}
                </div>
            </div>
        </div>
    );
}

function GradesTab({ grades }) {
    if (!grades.length) {
        return <EmptyPanel icon={Award} title="Nenhuma nota encontrada" description="As notas do aluno serão exibidas aqui após a sincronização." />;
    }

    return (
        <div className="space-y-3">
            {grades.map((grade, index) => (
                <motion.div
                    key={`${grade.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{grade.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">Avaliação consolidada da disciplina</p>
                        </div>
                        <Badge variant={grade.situacao === 'Aprovado' ? 'success' : grade.situacao === 'Reprovado' ? 'danger' : 'warning'}>
                            {grade.situacao || 'Em andamento'}
                        </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-3">
                        <ScoreCell label="VA1" value={grade.va1} />
                        <ScoreCell label="VA2" value={grade.va2} />
                        <ScoreCell label="VA3" value={grade.va3} />
                        <ScoreCell label="Media" value={grade.media} highlight />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function formatAttendanceSummary(item) {
    const totalClasses = item?.total_aulas;
    const absences = item?.total_faltas;
    const hasConfirmedAbsences = item?.faltas_confirmadas !== false && absences != null;

    if (hasConfirmedAbsences && totalClasses != null) {
        return `${absences} faltas em ${totalClasses} aulas`;
    }

    if (totalClasses != null) {
        return `${totalClasses} aulas registradas no portal`;
    }

    return 'Presença sincronizada do portal acadêmico';
}

function AttendanceTab({ attendance }) {
    if (!attendance.length) {
        return <EmptyPanel icon={Clock} title="Nenhuma frequência encontrada" description="Os dados de frequência serão exibidos aqui após a sincronização." />;
    }

    return (
        <div className="space-y-3">
            {attendance.map((item, index) => (
                <motion.div
                    key={`${item.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">{formatAttendanceSummary(item)}</p>
                        </div>
                        <Badge variant={item.percentual_presenca >= 75 ? 'success' : item.percentual_presenca >= 60 ? 'warning' : 'danger'}>
                            {item.percentual_presenca?.toFixed(0)}%
                        </Badge>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white">
                        <div
                            className={`h-2 rounded-full ${item.percentual_presenca >= 75 ? 'bg-success' : item.percentual_presenca >= 60 ? 'bg-warning' : 'bg-danger'}`}
                            style={{ width: `${Math.min(item.percentual_presenca || 0, 100)}%` }}
                        />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function SubjectsTab({ subjects }) {
    if (!subjects.length) {
        return <EmptyPanel icon={BookOpen} title="Nenhuma disciplina encontrada" description="As disciplinas do aluno aparecerão aqui quando houver sincronização ou vínculo acadêmico." />;
    }

    return (
        <div className="space-y-3">
            {subjects.map((subject, index) => (
                <motion.div
                    key={`${subject.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{subject.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">{subject.docente || 'Docente não informado'}</p>
                        </div>
                        <Badge variant={subject.situacao === 'Aprovado' || subject.situacao === 'Matriculado' ? 'success' : 'warning'}>
                            {subject.situacao || 'Em andamento'}
                        </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <InfoTile label="Período" value={subject.periodo} />
                        <InfoTile label="Início" value={subject.data_inicial} />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function ScheduleTab({ schedule }) {
    if (!schedule.length) {
        return <EmptyPanel icon={CalendarRange} title="Nenhum horário encontrado" description="O quadro de horários será exibido aqui quando o aluno tiver dados sincronizados." />;
    }

    return (
        <div className="space-y-3">
            {schedule.map((item, index) => (
                <motion.div
                    key={`${item.dia_nome}-${item.disciplina}-${index}`}
                    className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-text-primary">{item.disciplina}</p>
                            <p className="mt-1 text-sm text-text-secondary">{item.dia_nome} • {item.horario_inicio} - {item.horario_fim}</p>
                        </div>
                        <Badge variant="info">{item.local || 'Sem sala'}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-text-secondary">Professor: {item.professor || 'Não informado'}</p>
                </motion.div>
            ))}
        </div>
    );
}

function MetricMini({ label, value }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-2 text-lg font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function InfoLine({ icon: Icon, label, value }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-text-secondary">
                <Icon className="h-4 w-4 text-accent-blue" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
            </div>
            <p className="mt-2 text-sm font-medium text-text-primary">{value || '--'}</p>
        </div>
    );
}

function InfoTile({ label, value }) {
    return (
        <div className="rounded-2xl bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-2 text-sm font-medium text-text-primary">{value || '--'}</p>
        </div>
    );
}

function ScoreCell({ label, value, highlight = false }) {
    return (
        <div className={`rounded-2xl p-3 text-center ${highlight ? 'border border-border-subtle bg-white' : 'bg-white/70'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className={`mt-2 text-lg font-semibold ${highlight ? getGradeColorClass(value) : 'text-text-primary'}`}>
                {value == null ? '--' : Number(value).toFixed(1)}
            </p>
        </div>
    );
}

function EmptyPanel({ icon: Icon, title, description }) {
    return (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-border-subtle bg-bg-secondary/40 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient-soft text-accent-blue">
                <Icon className="h-6 w-6" />
            </div>
            <p className="mt-5 text-lg font-semibold text-text-primary">{title}</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
        </div>
    );
}

function EmptyInline({ text }) {
    return (
        <div className="rounded-[22px] border border-dashed border-border-subtle bg-white/60 px-5 py-10 text-center text-sm text-text-secondary">
            {text}
        </div>
    );
}

function getInitials(name = '') {
    return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function getGradeColorClass(value) {
    const numericValue = Number(value || 0);
    if (numericValue >= 7) return 'text-success';
    if (numericValue >= 5) return 'text-warning';
    return 'text-danger';
}

function getRiskBadgeVariant(level) {
    if (level === 'critical') return 'danger';
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

function formatRiskLabel(level) {
    if (level === 'critical') return 'Risco crítico';
    if (level === 'high') return 'Risco alto';
    if (level === 'medium') return 'Risco moderado';
    return 'Risco controlado';
}

function mapPriorityToBadge(priority) {
    if (priority === 'critical') return 'danger';
    if (priority === 'high') return 'warning';
    if (priority === 'medium') return 'info';
    return 'success';
}

function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('pt-BR');
}

function formatTrend(value) {
    const numericValue = Number(value || 0);
    if (numericValue > 0) return `+${numericValue.toFixed(2)}`;
    return numericValue.toFixed(2);
}

function PreventiveTab({ studentId, studentName }) {
    const [insights, setInsights] = useState(null);
    const [loadingInsights, setLoadingInsights] = useState(true);
    const [errorInsights, setErrorInsights] = useState('');

    const [channel, setChannel] = useState('email');
    const [draftText, setDraftText] = useState('');
    const [generatingDraft, setGeneratingDraft] = useState(false);
    const [errorDraft, setErrorDraft] = useState('');
    const [copied, setCopied] = useState(false);

    // Carregar insights ao montar o componente
    useEffect(() => {
        if (studentId) {
            setLoadingInsights(true);
            setErrorInsights('');
            api.get(`/students/${studentId}/insights`)
                .then((response) => {
                    setInsights(response.data.insights);
                })
                .catch((err) => {
                    console.error('Erro ao carregar insights de IA', err);
                    setErrorInsights('Não foi possível carregar os insights da IA para este aluno.');
                })
                .finally(() => setLoadingInsights(false));
        }
    }, [studentId]);

    // Gerar rascunho de mensagem preventiva
    const handleGenerateDraft = () => {
        setGeneratingDraft(true);
        setErrorDraft('');
        setDraftText('');
        api.post(`/students/${studentId}/draft-alert`, { channel })
            .then((response) => {
                setDraftText(response.data.draft);
            })
            .catch((err) => {
                console.error('Erro ao gerar rascunho de IA', err);
                setErrorDraft('Não foi possível gerar o rascunho com a IA no momento.');
            })
            .finally(() => setGeneratingDraft(false));
    };

    // Copiar texto para a área de transferência
    const handleCopy = () => {
        if (!draftText) return;
        navigator.clipboard.writeText(draftText)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch((err) => {
                console.error('Erro ao copiar texto', err);
            });
    };

    return (
        <div className="space-y-6">
            {/* Bloco 1: Insights da IA */}
            <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                    <h3 className="text-sm font-semibold text-text-primary">Plano Preventivo e Insights de IA ✨</h3>
                </div>

                {loadingInsights ? (
                    <div className="mt-5 space-y-3">
                        <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                        <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200" />
                        <div className="h-4 w-4/6 animate-pulse rounded bg-slate-200" />
                    </div>
                ) : errorInsights ? (
                    <p className="mt-4 text-sm text-danger">{errorInsights}</p>
                ) : insights ? (
                    <div className="mt-4 space-y-4">
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4">
                            <p className="text-sm font-medium leading-relaxed text-slate-800 italic">
                                "{insights.summary}"
                            </p>
                            {insights.offline_fallback && (
                                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                                    Offline Fallback • NEXORA Analítico Local
                                </span>
                            )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {/* Pontos Fortes */}
                            <div className="rounded-2xl bg-white p-4 shadow-sm border border-border-subtle">
                                <p className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Pontos Fortes
                                </p>
                                <ul className="mt-3 space-y-2.5">
                                    {insights.strengths?.map((item, idx) => (
                                        <li key={idx} className="text-xs text-text-secondary leading-relaxed">
                                            {typeof item === 'object' ? (
                                                <><strong>{item.title}:</strong> {item.description}</>
                                            ) : item}
                                        </li>
                                    )) || <li className="text-xs text-text-tertiary">Nenhum identificado.</li>}
                                </ul>
                            </div>

                            {/* Alertas */}
                            <div className="rounded-2xl bg-white p-4 shadow-sm border border-border-subtle">
                                <p className="text-xs font-bold uppercase tracking-wider text-danger flex items-center gap-1">
                                    <ShieldAlert className="h-3.5 w-3.5" /> Pontos de Atenção
                                </p>
                                <ul className="mt-3 space-y-2.5">
                                    {insights.alerts?.map((item, idx) => (
                                        <li key={idx} className="text-xs text-text-secondary leading-relaxed">
                                            {typeof item === 'object' ? (
                                                <><strong>{item.title}:</strong> {item.description}</>
                                            ) : item}
                                        </li>
                                    )) || <li className="text-xs text-text-tertiary">Nenhum identificado.</li>}
                                </ul>
                            </div>
                        </div>

                        {/* Dicas de Estudo */}
                        <div className="rounded-2xl bg-white p-4 shadow-sm border border-border-subtle">
                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5" /> Rota de Recuperação Recomendada
                            </p>
                            <ul className="mt-3 space-y-2.5">
                                {insights.study_tips?.map((item, idx) => (
                                    <li key={idx} className="text-xs text-text-secondary leading-relaxed flex items-start gap-1.5">
                                        <span className="text-indigo-400 mt-0.5">•</span>
                                        <span>
                                            {typeof item === 'object' ? (
                                                <><strong>{item.title}:</strong> {item.description}</>
                                            ) : item}
                                        </span>
                                    </li>
                                )) || <li className="text-xs text-text-tertiary">Nenhuma recomendação no momento.</li>}
                            </ul>
                        </div>
                    </div>
                ) : (
                    <p className="mt-4 text-xs text-text-tertiary">Sem insights gerados para o aluno.</p>
                )}
            </div>

            {/* Bloco 2: Rascunho de Mensagem Preventiva */}
            <div className="rounded-[24px] border border-border-subtle bg-bg-secondary/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <CalendarRange className="h-5 w-5 text-indigo-600" />
                        <h3 className="text-sm font-semibold text-text-primary">✉️ Enviar Alerta Preventivo de IA</h3>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={channel}
                            onChange={(e) => setChannel(e.target.value)}
                            className="rounded-xl border border-border-subtle bg-white px-3 py-1.5 text-xs font-semibold text-text-primary shadow-sm outline-none focus:border-indigo-400 transition"
                        >
                            <option value="email">E-mail</option>
                            <option value="whatsapp">WhatsApp</option>
                        </select>

                        <button
                            type="button"
                            onClick={handleGenerateDraft}
                            disabled={generatingDraft}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-xs font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            {generatingDraft ? 'Gerando...' : 'Gerar Rascunho'}
                        </button>
                    </div>
                </div>

                {errorDraft && (
                    <p className="mt-4 text-xs text-danger">{errorDraft}</p>
                )}

                <div className="mt-4 relative">
                    <textarea
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        placeholder="Clique em 'Gerar Rascunho' para usar a inteligência do NEXORA para redigir uma mensagem empática voltada para a recuperação do aluno com base em suas notas projetadas..."
                        rows={10}
                        className="w-full rounded-2xl border border-border-subtle bg-white p-4 text-xs leading-relaxed text-text-primary shadow-inner outline-none focus:border-indigo-400 transition font-sans resize-y"
                    />

                    {draftText && (
                        <div className="absolute bottom-4 right-4 flex items-center gap-2">
                            {copied && (
                                <span className="rounded-lg bg-success/10 px-2 py-1 text-[10px] font-bold text-success border border-success/20">
                                    Copiado!
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex items-center justify-center rounded-xl border border-border-subtle bg-white p-2 text-text-secondary hover:text-text-primary transition shadow"
                                title="Copiar mensagem"
                            >
                                <Award className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
                <p className="mt-2 text-[10px] text-text-tertiary">
                    Você pode alterar a mensagem livremente na caixa acima antes de copiar. O envio real deve ser feito através do seu gerenciador acadêmico habitual ou e-mail/WhatsApp institucional.
                </p>
            </div>
        </div>
    );
}
