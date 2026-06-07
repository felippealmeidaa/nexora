import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle,
    ArrowRight,
    BookOpen,
    BrainCircuit,
    CheckCircle2,
    GraduationCap,
    Layers3,
    ShieldAlert,
    Upload,
    Users,
    Sparkles,
    Brain,
    Target,
    Lightbulb,
    ChevronRight,
    Loader2,
    Paperclip,
    X,
    Activity,
    Zap,
    Compass
} from 'lucide-react';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { buildRolePath, getRoleMeta } from '@/lib/app-shell';
import { AnimatedBackground } from '@/components/ui/AnimatedBackground';

function getRiskVariant(level) {
    if (level === 'critical') return 'danger';
    if (level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

function buildAnalysisLink(role, analysis, params = {}) {
    const query = new URLSearchParams({ analysis });
    Object.entries(params).forEach(([key, value]) => {
        if (value) {
            query.set(key, String(value));
        }
    });
    return `${buildRolePath(role, 'analysis-center')}?${query.toString()}`;
}

export function ProfessorDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [overview, setOverview] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [subjectStudents, setSubjectStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    // Estados dos Insights de IA do Docente
    const [aiData, setAiData] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);

    const roleMeta = useMemo(() => getRoleMeta(user?.role), [user?.role]);
    const historicalDataRoute = buildRolePath(user?.role, 'historical-data');
    const analysisRoute = buildRolePath(user?.role, 'analysis-center');

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const [profileRes, overviewRes, studentsRes, workspaceRes] = await Promise.allSettled([
                    api.get('/professors/me'),
                    api.get('/professors/me/overview'),
                    api.get('/professors/me/students'),
                    api.get('/historical-data/analysis-workspace'),
                ]);

                if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
                if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
                if (studentsRes.status === 'fulfilled') setSubjectStudents(studentsRes.value.data);
                if (workspaceRes.status === 'fulfilled') setWorkspace(workspaceRes.value.data);
            } catch (error) {
                console.error('Erro ao carregar dashboard docente', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    // Consulta do Docente com IA (Gemini) filtrando pelas turmas dele automaticamente no backend
    async function generateProfessorAiInsights() {
        setAiLoading(true);
        setAiError(null);
        setAiData(null);
        try {
            const response = await api.get('/analytics/ai-insights');
            const result = response.data;
            if (result.error) {
                setAiError(result.error);
            } else {
                setAiData(result);
            }
        } catch (err) {
            setAiError('Impossível consultar a IA pedagógica. Certifique-se de que a GEMINI_API_KEY esteja preenchida.');
        } finally {
            setAiLoading(false);
        }
    }

    const topAtRisk = overview?.top_at_risk || [];
    const riskTopics = workspace?.analysis_data?.risk_topics || [];
    const criticalClasses = workspace?.analysis_data?.high_risk_classes || [];
    const criticalSubjects = useMemo(() => (
        riskTopics.filter((item) => item.type === 'Disciplina').slice(0, 4)
    ), [riskTopics]);
    const urgentAlerts = useMemo(() => (
        riskTopics.slice(0, 3)
    ), [riskTopics]);
    const academicCourses = profile?.academic_courses || [];
    const totalStudents = subjectStudents.reduce((sum, item) => sum + (item.students?.length || 0), 0);

    // Bento Card Wrapper com Haze Glassmorphism
    const BentoCard = ({ children, className = '', delay = 0, hoverEffect = true }) => (
        <motion.div
            initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
            whileHover={hoverEffect ? { 
                y: -4,
                scale: 1.01,
                transition: { duration: 0.24, ease: 'easeOut' }
            } : {}}
            className={`
                relative overflow-hidden rounded-[28px] 
                backdrop-blur-md bg-white/40 border border-white/20 
                shadow-[0_20px_40px_-24px_rgba(0,0,0,0.05)] 
                hover:shadow-[0_28px_50px_-16px_rgba(11,87,208,0.1)]
                hover:border-white/40 hover:bg-white/50
                transition-all duration-300 ${className}
            `}
        >
            <div className="p-6 md:p-7 h-full flex flex-col justify-between">
                {children}
            </div>
        </motion.div>
    );

    return (
        <div className="relative min-h-screen space-y-8 pb-16">
            {/* Mesh Gradient e Orbes Flutuantes Estilo Haze */}
            <AnimatedBackground variant="default" />

            {/* Header Docente Premium */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">
                            Espaço do Professor • Apoio ao Aprendizado
                        </span>
                    </div>
                    <h1 className="text-3.5xl md:text-4.5xl font-extrabold tracking-tight text-text-primary">
                        Painel Docente
                    </h1>
                    <p className="mt-2 text-xs text-text-secondary max-w-2xl leading-relaxed">
                        Acompanhamento contínuo de desempenho acadêmico das turmas, identificação de evasão e alertas institucionais.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <Link to={historicalDataRoute}>
                        <button className="px-5 py-3 rounded-2xl bg-white/70 hover:bg-white/90 text-text-primary font-bold text-xs shadow-sm border border-black/5 flex items-center gap-2 transition-all">
                            <Upload className="w-3.5 h-3.5 text-text-secondary" />
                            <span>Subir Base Histórica</span>
                        </button>
                    </Link>

                    <button
                        onClick={generateProfessorAiInsights}
                        disabled={aiLoading}
                        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-glow-sm flex items-center gap-2 transition-all"
                    >
                        {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>AI Insights</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-xs font-semibold text-text-secondary">Carregando dados pedagógicos...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10">
                    
                    {/* BENTO CARD 1: Hero Docente Integrado */}
                    <BentoCard className="md:col-span-8 bg-gradient-to-br from-blue-900/10 via-white/40 to-indigo-900/10 min-h-[200px]" delay={0.05}>
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                            <div className="space-y-4">
                                <Badge variant="info" className="px-3 py-1 font-semibold uppercase tracking-wider text-[9px] bg-blue-100 border border-blue-200">
                                    Corpo Docente Ativo
                                </Badge>
                                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary">
                                    Olá, {profile?.user_name ? profile.user_name.split(' ')[0] : 'Professor'}
                                </h2>
                                <p className="text-xs text-text-secondary leading-relaxed max-w-xl">
                                    Seu painel monitora {academicCourses.length} cursos acadêmicos e {subjectStudents.length} disciplinas sob sua tutela pedagógica. Acompanhe abaixo os principais indicadores estruturais.
                                </p>
                            </div>
                            <div className="h-14 w-14 rounded-full bg-white/80 shadow-md flex items-center justify-center border border-white/40 flex-shrink-0">
                                <GraduationCap className="h-7 h-7 text-blue-600" />
                            </div>
                        </div>
                    </BentoCard>

                    {/* BENTO CARD 2: Caixa Rápida de Uploader Estilizada */}
                    <BentoCard className="md:col-span-4 bg-gradient-to-br from-blue-600/10 to-indigo-600/15" delay={0.1}>
                        <div className="space-y-3.5">
                            <div className="h-9 w-9 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center border border-blue-500/20">
                                <Upload className="h-4.5 w-4.5" />
                            </div>
                            <h3 className="text-base font-bold text-text-primary">Geração de Nova Leitura</h3>
                            <p className="text-[11px] text-text-secondary leading-relaxed">
                                Suba planilhas acadêmicas ou PDFs para enriquecer as previsões de evasão por turma e disciplina.
                            </p>
                        </div>
                        <Link to={historicalDataRoute} className="mt-5 block">
                            <button className="w-full py-2.5 rounded-xl bg-white text-blue-600 border border-blue-200 font-bold text-xs hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
                                <Upload className="w-3.5 h-3.5" /> Fazer Upload de Base
                            </button>
                        </Link>
                    </BentoCard>

                    {/* BENTO GRID: 4 Re-styled Metric Cards */}
                    <BentoCard className="md:col-span-3 border-l-4 border-l-indigo-500" delay={0.15}>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Disciplinas</span>
                            <div className="p-2 rounded-xl bg-indigo-100/60 text-indigo-600">
                                <BookOpen className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-3xl font-extrabold text-text-primary tracking-tight">{subjectStudents.length}</h4>
                            <p className="text-[9px] text-text-secondary mt-1">{academicCourses.length} cursos cadastrados</p>
                        </div>
                    </BentoCard>

                    <BentoCard className="md:col-span-3 border-l-4 border-l-blue-500" delay={0.2}>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Alunos Monitorados</span>
                            <div className="p-2 rounded-xl bg-blue-100/60 text-blue-600">
                                <Users className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-3xl font-extrabold text-text-primary tracking-tight">{totalStudents}</h4>
                            <p className="text-[9px] text-text-secondary mt-1">Base sob acompanhamento</p>
                        </div>
                    </BentoCard>

                    <BentoCard className="md:col-span-3 border-l-4 border-l-rose-500" delay={0.25}>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Alertas Pendentes</span>
                            <div className="p-2 rounded-xl bg-rose-100/60 text-rose-600">
                                <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-3xl font-extrabold text-text-primary tracking-tight">{overview?.kpis?.at_risk_count || 0}</h4>
                            <p className="text-[9px] text-text-secondary mt-1">Intervenções preventivas</p>
                        </div>
                    </BentoCard>

                    <BentoCard className="md:col-span-3 border-l-4 border-l-amber-500" delay={0.3}>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider">Turmas Críticas</span>
                            <div className="p-2 rounded-xl bg-amber-100/60 text-amber-600">
                                <ShieldAlert className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-3xl font-extrabold text-text-primary tracking-tight">{workspace?.overview?.critical_classes || 0}</h4>
                            <p className="text-[9px] text-text-secondary mt-1">Turmas históricas de risco alto</p>
                        </div>
                    </BentoCard>

                    {/* BENTO CARD: Alertas Urgentes e Avisos Importantes (Colspan 8) */}
                    <BentoCard className="md:col-span-8 min-h-[380px]" delay={0.35} hoverEffect={false}>
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-rose-500" /> O que Merece sua Atenção Agora
                                    </h3>
                                    <p className="text-xs text-text-secondary">Cruzamento de reprovações atuais com previsões de risco</p>
                                </div>
                            </div>

                            <div className="mt-6 space-y-4 max-h-[260px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-black/5">
                                {urgentAlerts.length > 0 ? urgentAlerts.map((alert) => (
                                    <div
                                        key={alert.id}
                                        className="rounded-2xl border border-white/30 bg-white/20 hover:bg-white/40 p-4 transition-all flex flex-col gap-2"
                                    >
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <Badge variant={getRiskVariant(alert.risk_level)}>{alert.type}</Badge>
                                            <p className="text-xs font-bold text-text-primary">{alert.label}</p>
                                        </div>
                                        <p className="text-xs text-text-secondary leading-relaxed">{alert.signal}</p>
                                        <p className="text-[10px] text-text-tertiary">{alert.evidence}</p>
                                    </div>
                                )) : (
                                    <div className="text-center py-20 text-xs text-text-secondary bg-white/10 rounded-2xl border border-dashed border-black/5">
                                        Suba uma base analítica de notas para que o SIMA apresente alertas dinâmicos sobre evasão e reprovação.
                                    </div>
                                )}
                            </div>
                        </div>
                    </BentoCard>

                    {/* BENTO CARD: Próximos Passos (Colspan 4) */}
                    <BentoCard className="md:col-span-4 min-h-[380px]" delay={0.4}>
                        <div className="flex flex-col justify-between h-full">
                            <div>
                                <h3 className="text-lg font-bold text-text-primary mb-1">Passos Acadêmicos</h3>
                                <p className="text-xs text-text-secondary">Atalhos para tomada de decisões imediatas</p>
                                
                                <div className="mt-6 space-y-3.5">
                                    <Link
                                        to={`${analysisRoute}?analysis=risk_topics`}
                                        className="flex items-center justify-between rounded-xl border border-white/30 bg-white/10 p-3 hover:bg-white/40 transition hover:border-blue-400 group"
                                    >
                                        <div>
                                            <p className="text-xs font-bold text-text-primary">Mapear Assuntos em Risco</p>
                                            <p className="text-[9px] text-text-secondary mt-0.5">Assuntos teóricos de maior dificuldade.</p>
                                        </div>
                                        <ChevronRight className="h-4.5 w-4.5 text-blue-500 group-hover:translate-x-1 transition-transform" />
                                    </Link>

                                    <Link
                                        to={`${analysisRoute}?analysis=by_class`}
                                        className="flex items-center justify-between rounded-xl border border-white/30 bg-white/10 p-3 hover:bg-white/40 transition hover:border-blue-400 group"
                                    >
                                        <div>
                                            <p className="text-xs font-bold text-text-primary">Comparativo de Semestres</p>
                                            <p className="text-[9px] text-text-secondary mt-0.5">Analise o desempenho geral das classes.</p>
                                        </div>
                                        <ChevronRight className="h-4.5 w-4.5 text-blue-500 group-hover:translate-x-1 transition-transform" />
                                    </Link>

                                    <Link
                                        to={historicalDataRoute}
                                        className="flex items-center justify-between rounded-xl border border-white/30 bg-white/10 p-3 hover:bg-white/40 transition hover:border-blue-400 group"
                                    >
                                        <div>
                                            <p className="text-xs font-bold text-text-primary">Subir Planilhas de Notas</p>
                                            <p className="text-[9px] text-text-secondary mt-0.5">Importar bases de histórico curricular.</p>
                                        </div>
                                        <ChevronRight className="h-4.5 w-4.5 text-blue-500 group-hover:translate-x-1 transition-transform" />
                                    </Link>
                                </div>
                            </div>

                            <p className="text-[9px] text-text-secondary border-t border-black/5 pt-3 mt-4">
                                Métricas geradas com base na normalização sistêmica.
                            </p>
                        </div>
                    </BentoCard>

                    {/* BENTO GRIDS: Turmas Críticas & Disciplinas (Se houver turmas críticas) */}
                    {criticalClasses.length > 0 && (
                        <>
                            {/* BENTO CARD: Turmas em Estado Crítico (Colspan 6) */}
                            <BentoCard className="md:col-span-6 min-h-[400px]" delay={0.45}>
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                                <Layers3 className="w-4 h-4 text-blue-600" /> Turmas em Estado Crítico
                                            </h3>
                                            <p className="text-xs text-text-secondary">Selecione para explorar o perfil da turma</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 space-y-3.5 max-h-[280px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-black/5">
                                        {criticalClasses.slice(0, 5).map((item) => (
                                            <Link
                                                key={item.id}
                                                to={buildAnalysisLink(user?.role, 'by_class', { subject: item.subject, semester: item.semester })}
                                                className="block rounded-2xl border border-white/30 bg-white/20 hover:bg-white/40 p-4 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-bold text-text-primary">{item.label}</p>
                                                        <p className="text-[9px] text-text-secondary mt-0.5">
                                                            {item.course_name} • {item.semester}
                                                        </p>
                                                    </div>
                                                    <Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge>
                                                </div>
                                                <div className="mt-3 grid grid-cols-3 gap-2.5 text-[10px] text-text-secondary">
                                                    <div className="rounded-xl bg-white/60 p-2 border border-black/5">
                                                        <p className="text-[8px] font-semibold uppercase text-text-tertiary">Média Notas</p>
                                                        <p className="font-bold text-text-primary mt-0.5">{item.avg_grade.toFixed(2)}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-white/60 p-2 border border-black/5">
                                                        <p className="text-[8px] font-semibold uppercase text-text-tertiary">Presença</p>
                                                        <p className="font-bold text-text-primary mt-0.5">{item.avg_attendance.toFixed(1)}%</p>
                                                    </div>
                                                    <div className="rounded-xl bg-white/60 p-2 border border-black/5">
                                                        <p className="text-[8px] font-semibold uppercase text-text-tertiary">Criticos</p>
                                                        <p className="font-bold text-text-primary mt-0.5">{item.critical_students} alunos</p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </BentoCard>

                            {/* BENTO CARD: Disciplinas Sensíveis (Colspan 6) */}
                            <BentoCard className="md:col-span-6 min-h-[400px]" delay={0.5}>
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                                <BrainCircuit className="w-4 h-4 text-indigo-500" /> Disciplinas Mais Sensíveis
                                            </h3>
                                            <p className="text-xs text-text-secondary">Clique para verificar assuntos de alta reprovação</p>
                                        </div>
                                    </div>

                                    <div className="mt-6 space-y-3.5 max-h-[280px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-black/5">
                                        {criticalSubjects.map((item) => (
                                            <Link
                                                key={item.id}
                                                to={buildAnalysisLink(user?.role, 'risk_topics', { subject: item.label })}
                                                className="block rounded-2xl border border-white/30 bg-white/20 hover:bg-white/40 p-4 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-bold text-text-primary">{item.label}</p>
                                                        <p className="text-[9px] text-text-secondary mt-0.5">{item.signal}</p>
                                                    </div>
                                                    <Badge variant={getRiskVariant(item.risk_level)}>{item.type}</Badge>
                                                </div>
                                                <p className="text-[10px] text-text-secondary mt-2.5 leading-relaxed">{item.evidence}</p>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </BentoCard>
                        </>
                    )}

                    {/* BENTO CARD: Alunos em Risco Imediato (Colspan 12) */}
                    <BentoCard className="md:col-span-12 min-h-[380px]" delay={0.55} hoverEffect={false}>
                        <div>
                            <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Alunos que Pedem Ação Imediata
                                    </h3>
                                    <p className="text-xs text-text-secondary">Pressione sobre o estudante para abrir seu perfil analítico completo</p>
                                </div>
                            </div>

                            <div className="mt-6 space-y-3 max-h-[280px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-black/5">
                                {topAtRisk.length > 0 ? topAtRisk.slice(0, 8).map((student, index) => (
                                    <motion.div
                                        key={student.student_id}
                                        className="grid gap-3 rounded-2xl border border-white/30 bg-white/20 hover:bg-white/45 p-4 lg:grid-cols-[1.45fr_repeat(3,0.55fr)_0.6fr] items-center transition-all duration-200"
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                    >
                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedStudentId(student.student_id)}
                                                className="text-xs font-bold text-text-primary transition-colors hover:text-blue-600 block text-left"
                                            >
                                                {student.student_name}
                                            </button>
                                            <p className="text-[9px] text-text-secondary mt-0.5">{student.registration_number}</p>
                                        </div>
                                        <MiniMetricCard label="GPA" value={student.gpa?.toFixed(2) || '--'} />
                                        <MiniMetricCard label="Presença" value={`${student.attendance_rate?.toFixed(0) || '--'}%`} />
                                        <MiniMetricCard label="Risco" value={`${((student.risk_score || 0) * 100).toFixed(0)}%`} />
                                        
                                        <div className="flex items-center lg:justify-end">
                                            <Badge variant={getRiskVariant(student.risk_level)}>{student.risk_level}</Badge>
                                        </div>
                                    </motion.div>
                                )) : (
                                    <div className="text-center py-20 text-xs text-text-secondary bg-white/10 rounded-2xl border border-dashed border-black/5">
                                        Nenhum aluno identificado em risco pedagógico no momento.
                                    </div>
                                )}
                            </div>
                        </div>
                    </BentoCard>

                    {/* BENTO CARD 11: Seção Estratégica Completa de IA do Professor (Colspan 12) */}
                    <div id="ai-insights-section" className="md:col-span-12 relative mt-4">
                        <BentoCard className="bg-gradient-to-br from-blue-900/5 via-white/50 to-indigo-900/5" delay={0.6} hoverEffect={false}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-black/5 pb-6 mb-8 gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
                                        <Brain className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-text-primary">Consultoria Pedagógica com IA</h3>
                                        <p className="text-xs text-text-secondary">Recomendações e análise de trancamento escolar baseados em Inteligência Artificial</p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={generateProfessorAiInsights}
                                    disabled={aiLoading}
                                    className="px-5 py-2.5 rounded-xl font-semibold text-xs text-white
                                               bg-gradient-to-r from-blue-600 to-indigo-600
                                               hover:from-blue-500 hover:to-indigo-500
                                               transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25
                                               disabled:opacity-50 disabled:cursor-not-allowed
                                               flex items-center gap-2"
                                >
                                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    {aiData ? 'Recalcular Relatório' : 'Analisar minhas turmas'}
                                </button>
                            </div>

                            <AnimatePresence mode="wait">
                                {aiLoading && !aiData && (
                                    <motion.div
                                        key="loading"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col items-center justify-center py-20"
                                    >
                                        <div className="relative">
                                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 
                                                            flex items-center justify-center animate-pulse">
                                                <Brain className="w-10 h-10 text-blue-600" />
                                            </div>
                                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin absolute -bottom-2 -right-2" />
                                        </div>
                                        <p className="text-text-primary mt-6 font-semibold animate-pulse">O Gemini está gerando as análises da sua sala de aula...</p>
                                        <p className="text-text-secondary text-xs mt-2">Isto pode demorar cerca de 10 segundos enquanto geramos as diretrizes.</p>
                                    </motion.div>
                                )}

                                {aiError && !aiLoading && (
                                    <motion.div 
                                        key="error"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center py-10 text-center"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-text-primary">Erro na geração da IA</h4>
                                        <p className="text-xs text-text-secondary max-w-md mt-1">{aiError}</p>
                                        <button 
                                            onClick={generateProfessorAiInsights}
                                            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors"
                                        >
                                            Tentar Novamente
                                        </button>
                                    </motion.div>
                                )}

                                {!aiData && !aiError && !aiLoading && (
                                    <motion.div 
                                        key="empty"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex flex-col items-center justify-center py-12 text-center"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-5">
                                            <Sparkles className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <h4 className="text-sm font-bold text-text-primary">Relatório pedagógico de IA disponível</h4>
                                        <p className="text-xs text-text-secondary max-w-sm mt-2">
                                            Cruze as faltas em tempo real com as avaliações curriculares para sugerir dinâmicas de apoio de forma personalizada a cada aluno sob sua responsabilidade.
                                        </p>
                                        <button
                                            onClick={generateProfessorAiInsights}
                                            className="mt-5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-glow-sm"
                                        >
                                            Consultar IA Pedagógica
                                        </button>
                                    </motion.div>
                                )}

                                {aiData && !aiLoading && (
                                    <motion.div
                                        key="results"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="space-y-8"
                                    >
                                        {/* IA Resumo Geral */}
                                        {aiData.summary && (
                                            <div className="p-4 rounded-2xl bg-white/30 border border-white/40 flex items-start gap-4">
                                                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                                                    <Sparkles className="w-4 h-4" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Parecer do Conselheiro de IA</h4>
                                                    <p className="text-xs text-text-secondary leading-relaxed">{aiData.summary}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* IA Padrões Identificados */}
                                        {aiData.patterns?.length > 0 && (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Brain className="w-4 h-4 text-blue-600" />
                                                    <h4 className="text-sm font-bold text-text-primary">Padrões Pedagógicos Encontrados nas Turmas</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {aiData.patterns.map((p, index) => {
                                                        const sev = severityConfig[p.severity] || severityConfig.medium;
                                                        return (
                                                            <div key={index} className="p-4 rounded-2xl bg-white/20 border border-white/20 flex flex-col justify-between">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 justify-between">
                                                                        <h5 className="text-xs font-bold text-text-primary">{p.title}</h5>
                                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${sev.bg}`}>{sev.label}</span>
                                                                    </div>
                                                                    <p className="text-[11px] text-text-secondary leading-relaxed">{p.description}</p>
                                                                </div>
                                                                {p.affected_percentage != null && (
                                                                    <div className="mt-4">
                                                                        <div className="flex justify-between items-center text-[9px] text-text-secondary mb-1">
                                                                            <span>Alunos afetados:</span>
                                                                            <span>{p.affected_percentage}%</span>
                                                                        </div>
                                                                        <div className="h-1 bg-black/5 rounded-full overflow-hidden">
                                                                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.affected_percentage}%` }} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* IA Alunos em Foco */}
                                        {aiData.focus_students?.length > 0 && (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Target className="w-4 h-4 text-rose-500" />
                                                    <h4 className="text-sm font-bold text-text-primary">Estudantes sob Atenção Específica</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {aiData.focus_students.map((student, index) => (
                                                        <div key={index} className="p-4 rounded-2xl bg-white/20 border border-white/20 space-y-3">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <button
                                                                        onClick={() => setSelectedStudentId(student.student_id)}
                                                                        className="text-xs font-bold text-text-primary hover:text-blue-600 text-left"
                                                                    >
                                                                        {student.student_name}
                                                                    </button>
                                                                    <p className="text-[9px] text-text-secondary mt-0.5">Código Acadêmico: {student.student_id}</p>
                                                                </div>
                                                                <span className="text-[9px] bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full font-semibold">Crítico</span>
                                                            </div>
                                                            <p className="text-[11px] text-text-secondary leading-relaxed">{student.reason}</p>
                                                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 text-[10px] leading-relaxed border border-emerald-500/10">
                                                                <strong>Sugestão pedagógica:</strong> {student.suggested_action}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* IA Recomendações Estratégicas */}
                                        {aiData.strategic_recommendations?.length > 0 && (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <Lightbulb className="w-4 h-4 text-blue-500" />
                                                    <h4 className="text-sm font-bold text-text-primary">Estratégias de Apoio às Aulas</h4>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {aiData.strategic_recommendations.map((rec, index) => (
                                                        <div key={index} className="p-4 rounded-2xl bg-white/20 border border-white/20 flex gap-3">
                                                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 h-fit">
                                                                <Lightbulb className="w-4 h-4" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h5 className="text-xs font-bold text-text-primary">{rec.title}</h5>
                                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${
                                                                        rec.impact === 'high' ? 'bg-red-500/10 text-red-500' :
                                                                        rec.impact === 'medium' ? 'bg-amber-500/10 text-amber-500' :
                                                                        'bg-emerald-500/10 text-emerald-500'
                                                                    }`}>
                                                                        {rec.impact}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[11px] text-text-secondary leading-relaxed">{rec.description}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Chat consultivo com AI embutido no bento de professor */}
                            <div className="mt-8 pt-8 border-t border-black/5">
                                <div className="flex items-center gap-2 mb-4">
                                    <Zap className="w-4 h-4 text-amber-500" />
                                    <h4 className="text-sm font-bold text-text-primary">Conversar com o Mentor Acadêmico de IA</h4>
                                </div>
                                <ProfessorAIChat />
                            </div>
                        </BentoCard>
                    </div>

                </div>
            )}

            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}

function MiniMetricCard({ label, value }) {
    return (
        <div className="rounded-xl bg-white/80 border border-black/5 px-2.5 py-1.5 text-center shadow-sm">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
            <p className="mt-0.5 text-xs font-bold text-text-primary">{value}</p>
        </div>
    );
}

/* COMPONENTE DE CHAT DO PROFESSOR */
function ProfessorAIChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState(null);
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        setSelectedFile(file);

        const reader = new FileReader();
        reader.onload = (event) => {
            setFileContent(event.target.result);
        };
        reader.readAsText(file);
    }

    async function sendMessage(e) {
        e.preventDefault();
        if ((!input.trim() && !selectedFile) || loading) return;

        const userMsg = {
            role: 'user',
            content: input + (selectedFile ? `\n[Planilha/PDF anexado: ${selectedFile.name}]` : '')
        };
        setMessages(prev => [...prev, userMsg]);

        const currentInput = input;
        const currentFileContent = fileContent;

        setInput('');
        setSelectedFile(null);
        setFileContent(null);
        setLoading(true);

        try {
            const response = await api.post('/analytics/ai-insights/chat', {
                message: currentInput || "Por favor, analise a base pedagógica de alunos.",
                history: messages,
                file_content: currentFileContent
            });
            setMessages(prev => [...prev, { role: 'ai', content: response.data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'ai', content: 'Erro de comunicação com o assistente pedagógico. Verifique se o backend está ativo.' }]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="rounded-2xl border border-black/5 bg-white/20 overflow-hidden flex flex-col h-[340px]">
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-thumb-black/5"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <Compass className="w-8 h-8 text-blue-400 mb-2.5 animate-spin" style={{ animationDuration: '8s' }} />
                        <p className="text-xs font-semibold text-text-primary">Orientador de IA Docente</p>
                        <p className="text-[9px] text-text-secondary max-w-xs mt-1">
                            Pergunte sobre como motivar alunos com baixa presença, solicite dicas pedagógicas de recuperação contínua ou insira planilhas/anotações de notas das turmas para análise rápida.
                        </p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`
                            max-w-[75%] p-3 rounded-2xl text-[11px] leading-relaxed 
                            ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-tr-none shadow-md'
                                : 'bg-white/70 text-text-primary border border-black/5 rounded-tl-none shadow-sm'
                            }
                        `}>
                            {msg.content}
                        </div>
                    </motion.div>
                ))}

                {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                        <div className="bg-white/70 px-4 py-2.5 rounded-2xl rounded-tl-none border border-black/5 shadow-sm">
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                        </div>
                    </motion.div>
                )}
            </div>

            {selectedFile && (
                <div className="mx-4 mb-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Paperclip className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        <span className="text-[10px] text-blue-700 truncate">{selectedFile.name}</span>
                    </div>
                    <button
                        onClick={() => { setSelectedFile(null); setFileContent(null); }}
                        className="p-1 hover:bg-blue-500/20 rounded-md transition-colors"
                    >
                        <X className="w-3 h-3 text-blue-600" />
                    </button>
                </div>
            )}

            <form onSubmit={sendMessage} className="p-3 bg-white/40 border-t border-black/5 flex gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".csv,.txt,.json"
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 rounded-xl bg-white/60 border border-black/5 text-text-secondary hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"
                    title="Anexar dados analíticos"
                >
                    <Paperclip className="w-4 h-4" />
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={selectedFile ? "Processando anexo acadêmico..." : "Escreva sua dúvida pedagógica..."}
                    className="flex-1 bg-white/60 border border-black/5 rounded-xl px-4 py-2 text-xs text-text-primary focus:outline-none focus:border-blue-500 shadow-inner"
                />
                <button
                    disabled={loading || (!input.trim() && !selectedFile)}
                    className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-glow-sm"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
