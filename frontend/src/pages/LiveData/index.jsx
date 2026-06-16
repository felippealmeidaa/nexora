import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    BookOpen,
    Filter,
    LineChart as LineChartIcon,
    Loader2,
    RefreshCcw,
    Search,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useDataMode } from '@/contexts/DataModeContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

const CLASSES_PER_PAGE = 6;
const STUDENTS_PER_PAGE = 15;

const riskLabels = {
    low: 'Baixo',
    medium: 'Médio',
    high: 'Alto',
    critical: 'Crítico',
};

const chartLabelMap = {
    atual: 'Atual',
    projetado: 'Projetado',
    valor: 'Valor',
    risk: 'Risco (%)',
    attendance: 'Frequência (%)',
    grade: 'Média (0-10)',
};

function getRiskVariant(level) {
    if (level === 'critical' || level === 'high') return 'danger';
    if (level === 'medium') return 'attention';
    return 'success';
}

function normalizeToken(value) {
    return String(value || '').trim().toLowerCase();
}

function getStudentKey(student) {
    return `${student.student_code || 'sem-codigo'}-${student.student_name || 'aluno'}`;
}

function matchesStudentSearch(student, term) {
    const normalizedTerm = normalizeToken(term);
    if (!normalizedTerm) return false;
    return [
        student.student_name,
        student.student_code,
        student.status_label,
        student.academic_course_name,
    ]
        .filter(Boolean)
        .some((value) => normalizeToken(value).includes(normalizedTerm));
}

function StudentChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-2xl border border-border-subtle bg-white px-4 py-3 shadow-card">
            <p className="text-xs font-semibold text-text-primary">{label}</p>
            <div className="mt-2 space-y-1.5">
                {payload.map((item) => (
                    <p key={`${item.dataKey}-${item.value}`} className="text-xs font-medium" style={{ color: item.color || item.fill }}>
                        {chartLabelMap[item.dataKey] || item.name || item.dataKey}: <span className="font-semibold text-text-primary">{item.value ?? '--'}</span>
                    </p>
                ))}
            </div>
        </div>
    );
}

export function LiveDataPage() {
    const { user } = useAuth();
    const { dataMode, setDataMode } = useDataMode();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [classes, setClasses] = useState([]);
    const [filters, setFilters] = useState({ courses: [], professors: [] });
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [activeStudentKey, setActiveStudentKey] = useState(null);
    const [classPage, setClassPage] = useState(1);
    const [studentPage, setStudentPage] = useState(1);
    const [query, setQuery] = useState({ course_name: '', professor_user_id: '', search: '' });
    const [studentModal, setStudentModal] = useState({
        isOpen: false,
        loading: false,
        error: '',
        data: null,
    });
    const [lastAutoOpenedSearch, setLastAutoOpenedSearch] = useState('');

    const isAdmin = user?.role === 'admin';
    const canRefreshFromLyceum = user?.role === 'professor';

    const loadClasses = async (nextSelectedClassId = null) => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/live-data/classes', {
                params: {
                    course_name: query.course_name || undefined,
                    professor_user_id: query.professor_user_id || undefined,
                    search: query.search || undefined,
                },
            });
            const nextClasses = response.data || [];
            setClasses(nextClasses);
            setClassPage(1);

            if (!nextClasses.length) {
                setSelectedClassId(null);
                setSelectedClass(null);
                setActiveStudentKey(null);
                setStudentModal({ isOpen: false, loading: false, error: '', data: null });
                return;
            }

            const fallbackId = nextSelectedClassId || selectedClassId || nextClasses[0]?.id;
            const resolvedId = nextClasses.some((item) => item.id === fallbackId)
                ? fallbackId
                : nextClasses[0]?.id;
            setSelectedClassId(resolvedId);
        } catch (err) {
            console.error('Erro ao carregar dados em tempo real', err);
            setError(err.response?.data?.detail || 'Não foi possível carregar as turmas do Lyceum.');
        } finally {
            setLoading(false);
        }
    };

    const loadFilters = async () => {
        try {
            const response = await api.get('/live-data/catalog');
            setFilters(response.data?.filters || { courses: [], professors: [] });
        } catch (err) {
            console.error('Erro ao carregar filtros', err);
        }
    };

    useEffect(() => {
        if (dataMode !== 'real') return;
        loadFilters();
        loadClasses();
    }, [dataMode, query.course_name, query.professor_user_id]);

    useEffect(() => {
        if (!selectedClassId || dataMode !== 'real') return;

        let cancelled = false;

        async function fetchDetail() {
            try {
                const response = await api.get(`/live-data/classes/${selectedClassId}`);
                if (!cancelled) {
                    setSelectedClass(response.data);
                    setStudentPage(1);
                    setActiveStudentKey(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('Erro ao carregar detalhe da turma', err);
                    setSelectedClass(null);
                    setActiveStudentKey(null);
                }
            }
        }

        fetchDetail();
        return () => {
            cancelled = true;
        };
    }, [dataMode, selectedClassId]);

    useEffect(() => {
        setStudentPage(1);
    }, [query.search, selectedClassId]);

    const visibleClasses = useMemo(() => classes, [classes]);

    const paginatedClasses = useMemo(() => {
        const start = (classPage - 1) * CLASSES_PER_PAGE;
        return visibleClasses.slice(start, start + CLASSES_PER_PAGE);
    }, [classPage, visibleClasses]);

    const classPageCount = Math.max(1, Math.ceil(visibleClasses.length / CLASSES_PER_PAGE));

    const filteredStudents = useMemo(() => {
        const students = selectedClass?.students || [];
        const searchKey = normalizeToken(query.search);
        if (!searchKey) return students;
        return students.filter((student) => matchesStudentSearch(student, searchKey));
    }, [query.search, selectedClass]);

    const paginatedStudents = useMemo(() => {
        const start = (studentPage - 1) * STUDENTS_PER_PAGE;
        return filteredStudents.slice(start, start + STUDENTS_PER_PAGE);
    }, [filteredStudents, studentPage]);

    const studentPageCount = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE));

    async function openStudentAnalysis(student, options = {}) {
        if (!selectedClass?.id || !student) return;

        const studentKey = getStudentKey(student);
        setActiveStudentKey(studentKey);
        setStudentModal({
            isOpen: true,
            loading: true,
            error: '',
            data: null,
        });

        try {
            const response = await api.get('/live-data/student-analysis', {
                params: {
                    class_id: selectedClass.id,
                    student_code: student.student_code || undefined,
                    student_name: student.student_name || undefined,
                },
            });
            setStudentModal({
                isOpen: true,
                loading: false,
                error: '',
                data: response.data,
            });

            if (options.searchStamp) {
                setLastAutoOpenedSearch(options.searchStamp);
            }
        } catch (err) {
            console.error('Erro ao carregar análise individual do aluno', err);
            setStudentModal({
                isOpen: true,
                loading: false,
                error: err.response?.data?.detail || 'Não foi possível abrir a análise individual do aluno.',
                data: null,
            });
        }
    }

    function closeStudentAnalysis() {
        setStudentModal((previous) => ({
            ...previous,
            isOpen: false,
            loading: false,
        }));
    }

    useEffect(() => {
        const searchKey = normalizeToken(query.search);
        if (!searchKey || !selectedClass?.id) {
            setLastAutoOpenedSearch('');
            return;
        }
        if (searchKey.length < 3 || !filteredStudents.length) return;

        const exactMatch = filteredStudents.find((student) => (
            normalizeToken(student.student_name) === searchKey || normalizeToken(student.student_code) === searchKey
        ));
        const candidate = exactMatch || (filteredStudents.length === 1 ? filteredStudents[0] : null);
        if (!candidate) return;

        const stamp = `${selectedClass.id}:${searchKey}:${getStudentKey(candidate)}`;
        if (stamp === lastAutoOpenedSearch) return;
        openStudentAnalysis(candidate, { searchStamp: stamp });
    }, [filteredStudents, lastAutoOpenedSearch, query.search, selectedClass?.id]);

    const handleRefresh = async () => {
        setRefreshing(true);
        setError('');
        try {
            if (isAdmin && query.professor_user_id) {
                await api.post('/live-data/refresh', null, {
                    params: { professor_user_id: query.professor_user_id },
                });
            } else {
                await api.post('/live-data/refresh');
            }
            await loadClasses(selectedClassId);
        } catch (err) {
            console.error('Erro ao atualizar dados', err);
            setError(err.response?.data?.detail || 'Não foi possível atualizar os dados do Lyceum.');
        } finally {
            setRefreshing(false);
        }
    };

    if (dataMode !== 'real') {
        return (
            <div className="space-y-6">
                <Card>
                    <EmptyState
                        icon={BookOpen}
                        title="Modo de planilhas ativo"
                        description="Troque para dados em tempo real se quiser voltar ao espelho das turmas do Lyceum."
                        action={<Button onClick={() => setDataMode('real')}>Ativar dados em tempo real</Button>}
                    />
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error ? (
                <div className="rounded-[22px] border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}

            <Card>
                <CardHeader
                    title="Filtros"
                    subtitle="Refine as turmas e encontre alunos específicos para abrir a leitura individual"
                    icon={Filter}
                    action={canRefreshFromLyceum ? (
                        <Button icon={RefreshCcw} loading={refreshing} onClick={handleRefresh}>
                            Atualizar dados
                        </Button>
                    ) : null}
                />

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-2 text-sm text-text-secondary">
                        <span className="font-semibold text-text-primary">Curso</span>
                        <select
                            value={query.course_name}
                            onChange={(event) => setQuery((previous) => ({ ...previous, course_name: event.target.value }))}
                            className="h-11 w-full rounded-2xl border border-border-subtle bg-bg-card px-4 text-sm text-text-primary outline-none"
                        >
                            <option value="">Todos os cursos</option>
                            {filters.courses.map((course) => (
                                <option key={course} value={course}>{course}</option>
                            ))}
                        </select>
                    </label>

                    {isAdmin ? (
                        <label className="space-y-2 text-sm text-text-secondary">
                            <span className="font-semibold text-text-primary">Professor</span>
                            <select
                                value={query.professor_user_id}
                                onChange={(event) => setQuery((previous) => ({ ...previous, professor_user_id: event.target.value }))}
                                className="h-11 w-full rounded-2xl border border-border-subtle bg-bg-card px-4 text-sm text-text-primary outline-none"
                            >
                                <option value="">Todos os professores</option>
                                {filters.professors.map((professor) => (
                                    <option key={professor.user_id} value={professor.user_id}>{professor.name}</option>
                                ))}
                            </select>
                        </label>
                    ) : null}

                    <label className="space-y-2 text-sm text-text-secondary md:col-span-2 xl:col-span-2">
                        <span className="font-semibold text-text-primary">Busca rápida</span>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                            <input
                                value={query.search}
                                onChange={(event) => setQuery((previous) => ({ ...previous, search: event.target.value }))}
                                placeholder="Disciplina, turma, aluno ou curso"
                                className="h-11 w-full rounded-2xl border border-border-subtle bg-bg-card pl-10 pr-4 text-sm text-text-primary outline-none"
                            />
                        </div>
                    </label>
                </div>

                <div className="mt-4 flex justify-start">
                    <Button variant="secondary" onClick={() => loadClasses(selectedClassId)}>
                        Aplicar filtros
                    </Button>
                </div>
            </Card>

            {loading ? (
                <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-border-subtle bg-bg-card">
                    <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                </div>
            ) : (
                <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
                    <Card>
                        <CardHeader
                            title="Turmas disponíveis"
                            subtitle="Mostrando 6 por página para facilitar a navegação"
                            icon={BookOpen}
                            action={<Badge variant="info">{visibleClasses.length} turmas</Badge>}
                        />
                        {paginatedClasses.length > 0 ? (
                            <>
                                <div className="space-y-3">
                                    {paginatedClasses.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedClassId(item.id)}
                                            className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
                                                selectedClassId === item.id
                                                    ? 'border-accent-blue/35 bg-accent-blue/10'
                                                    : 'border-border-subtle bg-bg-secondary/45 hover:border-border-hover hover:bg-bg-card'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-text-primary">{item.subject_name}</p>
                                                    <p className="mt-1 text-sm text-text-secondary">
                                                        {item.class_code || 'Turma sem código'} - {item.professor_name}
                                                    </p>
                                                    <p className="mt-1 text-xs text-text-tertiary">
                                                        {item.academic_course_name || 'Curso não informado'} - {item.period_label || 'Período não informado'}
                                                    </p>
                                                </div>
                                                <Badge variant="info">{item.students_count || 0} alunos</Badge>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <Pagination currentPage={classPage} totalPages={classPageCount} onPageChange={setClassPage} />
                            </>
                        ) : (
                            <EmptyState
                                icon={BookOpen}
                                title="Nenhuma turma encontrada"
                                description="Ajuste os filtros ou faça uma nova sincronização do professor."
                            />
                        )}
                    </Card>

                    <Card>
                        <CardHeader
                            title="Detalhes da turma"
                            subtitle="Clique no nome do aluno ou use a busca para abrir a análise individual"
                            icon={Users}
                            action={selectedClass ? <Badge variant="success">{filteredStudents.length} alunos no recorte</Badge> : null}
                        />
                        {selectedClass ? (
                            <div className="space-y-5">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    <InfoTile label="Curso" value={selectedClass.academic_course_name || 'Não informado'} />
                                    <InfoTile label="Turma" value={selectedClass.class_code || 'Sem código'} />
                                    <InfoTile label="Período letivo" value={selectedClass.period_label || 'Não informado'} />
                                    <InfoTile label="Matriculados" value={String(selectedClass.enrolled_count || selectedClass.students_count || 0)} />
                                </div>

                                <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/35 px-4 py-4 text-sm text-text-secondary">
                                    A leitura individual do aluno só aparece quando o professor clica em um nome na tabela ou quando a busca encontra um aluno específico.
                                </div>

                                <div className="overflow-x-auto rounded-[22px] border border-border-subtle">
                                    <table className="min-w-full divide-y divide-border-subtle text-sm">
                                        <thead className="bg-bg-secondary/55">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-semibold text-text-primary">Aluno</th>
                                                <th className="px-4 py-3 text-left font-semibold text-text-primary">Situação</th>
                                                <th className="px-4 py-3 text-left font-semibold text-text-primary">VA1</th>
                                                <th className="px-4 py-3 text-left font-semibold text-text-primary">VA2</th>
                                                <th className="px-4 py-3 text-left font-semibold text-text-primary">VA3</th>
                                                <th className="px-4 py-3 text-left font-semibold text-text-primary">Frequência</th>
                                                <th className="min-w-[168px] px-4 py-3 pr-12 text-left font-semibold text-text-primary">Risco</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle bg-white/60">
                                            {paginatedStudents.map((student) => {
                                                const active = getStudentKey(student) === activeStudentKey;
                                                return (
                                                    <tr key={getStudentKey(student)} className={active ? 'bg-accent-blue/5' : ''}>
                                                        <td className="px-4 py-3 text-text-primary">
                                                            <button
                                                                type="button"
                                                                onClick={() => openStudentAnalysis(student)}
                                                                className="text-left font-medium hover:text-accent-blue"
                                                            >
                                                                {student.student_name}
                                                            </button>
                                                        </td>
                                                        <td className="px-4 py-3 text-text-secondary">{student.status_label || 'Não informado'}</td>
                                                        <td className="px-4 py-3 text-text-secondary">{student.va1 ?? '--'}</td>
                                                        <td className="px-4 py-3 text-text-secondary">{student.va2 ?? '--'}</td>
                                                        <td className="px-4 py-3 text-text-secondary">{student.va3 ?? '--'}</td>
                                                        <td className="px-4 py-3 text-text-secondary">
                                                            {student.attendance_percentage != null ? `${Number(student.attendance_percentage).toFixed(1)}%` : '--'}
                                                        </td>
                                                        <td className="min-w-[168px] px-4 py-3 pr-12">
                                                            <div className="flex justify-start">
                                                                <Badge variant={getRiskVariant(student.risk_level)}>
                                                                    {riskLabels[student.risk_level] || student.risk_level}
                                                                </Badge>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredStudents.length ? (
                                    <Pagination currentPage={studentPage} totalPages={studentPageCount} onPageChange={setStudentPage} />
                                ) : (
                                    <EmptyState
                                        icon={Users}
                                        title="Nenhum aluno corresponde ao filtro"
                                        description="Ajuste a busca rápida para localizar o aluno que deseja analisar."
                                    />
                                )}
                            </div>
                        ) : (
                            <EmptyState
                                icon={Users}
                                title="Selecione uma turma"
                                description="Os alunos e a leitura individual aparecem aqui ao abrir uma turma."
                            />
                        )}
                    </Card>
                </div>
            )}

            <StudentAnalysisModal modalState={studentModal} onClose={closeStudentAnalysis} />
        </div>
    );
}

function StudentAnalysisModal({ modalState, onClose }) {
    const { isOpen, loading, error, data } = modalState;

    useEffect(() => {
        if (!isOpen) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const gradeChartData = (data?.grade_chart || []).map((item) => ({
        ...item,
        atual: item.actual,
        projetado: item.projected,
    }));

    const attendanceChartData = (data?.attendance_chart || []).map((item) => ({
        ...item,
        valor: item.value,
    }));

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-sm" onClick={onClose}>
            <div
                className="max-h-[calc(100vh-2rem)] w-full max-w-[1180px] overflow-y-auto rounded-[28px] border border-border-subtle bg-white shadow-card-hover"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-white/96 px-6 py-5 backdrop-blur">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-tertiary">Análise individual do aluno</p>
                        <h2 className="mt-2 text-2xl font-semibold text-text-primary">
                            {data?.student?.name || 'Carregando aluno'}
                        </h2>
                        {data?.classroom ? (
                            <p className="mt-2 text-sm text-text-secondary">
                                {data.classroom.subject_name} • {data.classroom.class_code || 'Turma sem código'}
                            </p>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-subtle bg-white text-text-secondary transition hover:border-border-hover hover:text-text-primary"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex min-h-[320px] items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                        </div>
                    ) : error ? (
                        <div className="rounded-[24px] border border-danger/20 bg-danger/8 px-6 py-10 text-center">
                            <AlertTriangle className="mx-auto h-8 w-8 text-danger" />
                            <p className="mt-4 text-lg font-semibold text-text-primary">Não foi possível abrir a análise</p>
                            <p className="mt-2 text-sm text-danger">{error}</p>
                        </div>
                    ) : data ? (
                        <div className="space-y-6">
                            <div className="grid gap-4 xl:grid-cols-5">
                                <InfoTile label="Código" value={data.student?.code || 'Não informado'} />
                                <InfoTile label="Situação" value={data.student?.status || 'Não informado'} />
                                <InfoTile label="Média atual" value={data.metrics?.current_average != null ? `${Number(data.metrics.current_average).toFixed(1)}` : 'Sem nota'} />
                                <InfoTile label="Frequência atual" value={data.metrics?.current_attendance != null ? `${Number(data.metrics.current_attendance).toFixed(1)}%` : '--'} />
                                <InfoTile label="Ranking de risco" value={data.summary?.class_rank ? `${data.summary.class_rank}° na turma` : 'Sem ranking'} />
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                                <Card variant="muted" animate={false}>
                                    <CardHeader
                                        title="Leitura consolidada"
                                        subtitle={data.summary?.text || 'Resumo analítico do aluno'}
                                        icon={TrendingUp}
                                        action={(
                                            <Badge variant={getRiskVariant(data.summary?.risk_level)}>
                                                {data.summary?.risk_level_label || 'Monitorar'}
                                            </Badge>
                                        )}
                                    />

                                    <div className="grid gap-4 md:grid-cols-3">
                                        <MiniInsight label="Risco atual" value={`${Number(data.summary?.risk_score_percent || 0).toFixed(1)}%`} />
                                        <MiniInsight label="Proj. média final" value={`${Number(data.projection?.projected_average || 0).toFixed(1)}`} />
                                        <MiniInsight label="Proj. frequência" value={`${Number(data.projection?.projected_attendance || 0).toFixed(1)}%`} />
                                    </div>

                                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                                        <div className="rounded-[22px] border border-border-subtle bg-white/80 p-4">
                                            <p className="text-sm font-semibold text-text-primary">Recomendação principal</p>
                                            <p className="mt-2 text-sm leading-6 text-text-secondary">
                                                {data.projection?.recommended_action || 'Manter acompanhamento e revisar o próximo ciclo avaliativo.'}
                                            </p>
                                            <div className="mt-4 space-y-2">
                                                {data.recommendations?.map((item) => (
                                                    <div key={item} className="rounded-2xl bg-bg-secondary/50 px-3 py-3 text-sm text-text-secondary">
                                                        {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-[22px] border border-border-subtle bg-white/80 p-4">
                                            <p className="text-sm font-semibold text-text-primary">Contexto usado pela previsão</p>
                                            <div className="mt-4 grid gap-3">
                                                <MiniInsight label="Histórico do aluno" value={`${data.summary?.historical_matches || 0} registro(s)`} />
                                                <MiniInsight label="Base histórica de treino" value={`${data.summary?.historical_training_records || 0} registros`} />
                                                <MiniInsight label="Média da turma" value={data.metrics?.class_average_grade != null ? `${Number(data.metrics.class_average_grade).toFixed(1)}` : '--'} />
                                                <MiniInsight label="Média histórica comparável" value={data.benchmarks?.historical_peer_average != null ? `${Number(data.benchmarks.historical_peer_average).toFixed(1)}` : '--'} />
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <div className="grid gap-4">
                                    <ChartCard title="Notas atuais e projetadas" icon={LineChartIcon}>
                                        <ResponsiveContainer width="100%" height={240}>
                                            <BarChart data={gradeChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                                <XAxis dataKey="label" />
                                                <YAxis domain={[0, 100]} />
                                                <Tooltip cursor={false} content={<StudentChartTooltip />} />
                                                <Bar
                                                    dataKey="atual"
                                                    fill="#2563EB"
                                                    radius={[8, 8, 0, 0]}
                                                />
                                                <Bar
                                                    dataKey="projetado"
                                                    fill="#A78BFA"
                                                    radius={[8, 8, 0, 0]}
                                                />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </ChartCard>

                                    <ChartCard title="Frequência e comparativo" icon={Users}>
                                        <ResponsiveContainer width="100%" height={220}>
                                            <LineChart data={attendanceChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                                <XAxis dataKey="label" />
                                                <YAxis domain={[0, 100]} />
                                                <Tooltip cursor={false} content={<StudentChartTooltip />} />
                                                <Line type="monotone" dataKey="valor" stroke="#10B981" strokeWidth={3} dot={{ r: 5 }} name="Frequência" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </ChartCard>
                                </div>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                                <Card variant="muted" animate={false}>
                                    <CardHeader
                                        title="Fatores de risco ponderados"
                                        subtitle="Pesos calculados na leitura estatística do aluno dentro do recorte atual"
                                        icon={AlertTriangle}
                                    />
                                    <div className="space-y-3">
                                        {(data.risk_factors || []).length ? data.risk_factors.map((factor) => (
                                            <div key={factor.key} className="rounded-[20px] border border-border-subtle bg-white/80 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold text-text-primary">{factor.label}</p>
                                                    <span className="text-sm font-semibold text-text-secondary">{factor.percent.toFixed(1)}%</span>
                                                </div>
                                                <div className="mt-3 h-2 rounded-full bg-bg-secondary">
                                                    <div
                                                        className="h-2 rounded-full bg-accent-blue"
                                                        style={{ width: `${Math.max(4, Math.min(100, factor.percent))}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="rounded-[20px] border border-dashed border-border-subtle bg-white/70 px-4 py-8 text-center text-sm text-text-secondary">
                                                Não houve fator dominante suficiente para compor o risco deste aluno.
                                            </div>
                                        )}
                                    </div>
                                </Card>

                                <Card variant="muted" animate={false}>
                                    <CardHeader
                                        title="Histórico e tendência"
                                        subtitle="Evolução lida pelo backend considerando o contexto atual e o histórico comparável"
                                        icon={TrendingUp}
                                    />
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart data={data.trend_chart || []}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                                            <XAxis dataKey="label" />
                                            <YAxis yAxisId="left" domain={[0, 100]} />
                                            <YAxis yAxisId="right" orientation="right" domain={[0, 10]} />
                                            <Tooltip cursor={false} content={<StudentChartTooltip />} />
                                            <Line yAxisId="left" type="monotone" dataKey="risk" stroke="#EF4444" strokeWidth={3} dot={{ r: 4 }} name="Risco (%)" />
                                            <Line yAxisId="left" type="monotone" dataKey="attendance" stroke="#10B981" strokeWidth={3} dot={{ r: 4 }} name="Frequência (%)" />
                                            <Line yAxisId="right" type="monotone" dataKey="grade" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} name="Média (0-10)" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Card>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function InfoTile({ label, value }) {
    return (
        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function MiniInsight({ label, value }) {
    return (
        <div className="rounded-2xl bg-bg-card px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">{label}</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
        </div>
    );
}

function ChartCard({ title, icon: Icon, children }) {
    return (
        <div className="rounded-[22px] border border-border-subtle bg-white/80 p-4">
            <div className="flex items-center gap-2">
                {Icon ? <Icon className="h-4 w-4 text-accent-blue" /> : null}
                <p className="text-sm font-semibold text-text-primary">{title}</p>
            </div>
            <div className="mt-3">{children}</div>
        </div>
    );
}

function Pagination({ currentPage, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
    return (
        <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                Anterior
            </Button>
            <div className="flex flex-wrap gap-2">
                {pages.map((page) => (
                    <button
                        key={page}
                        type="button"
                        onClick={() => onPageChange(page)}
                        className={[
                            'h-10 min-w-10 rounded-2xl border px-3 text-sm font-semibold transition',
                            page === currentPage
                                ? 'border-accent-blue bg-accent-blue text-white'
                                : 'border-border-subtle bg-white text-text-secondary hover:border-border-hover hover:text-text-primary',
                        ].join(' ')}
                    >
                        {page}
                    </button>
                ))}
            </div>
            <Button variant="secondary" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                Próxima
            </Button>
        </div>
    );
}
