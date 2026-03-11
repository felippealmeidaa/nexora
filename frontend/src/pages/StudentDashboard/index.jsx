import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import api from '@/services/api';
import {
    GraduationCap, BookOpen, TrendingUp, AlertTriangle,
    CheckCircle, Clock, Calendar, BarChart3, RefreshCw,
    Lock, Wifi, WifiOff, AlertCircle, Sparkles, Lightbulb, TrendingDown,
    Shield, Brain, Info
} from 'lucide-react';

export function StudentDashboard() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [grades, setGrades] = useState(null);
    const [attendance, setAttendance] = useState(null);
    const [schedule, setSchedule] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [aiInsights, setAiInsights] = useState(() => {
        try {
            const cached = localStorage.getItem(`sima_insights_${user?.id}`);
            return cached ? JSON.parse(cached) : null;
        } catch { return null; }
    });
    const [loading, setLoading] = useState(true);
    const [loadingInsights, setLoadingInsights] = useState(false);

    // Sync state
    const [syncStatus, setSyncStatus] = useState('idle');
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [hasCredentials, setHasCredentials] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [lyceumPassword, setLyceumPassword] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const pollingRef = useRef(null);
    const autoSyncTriggered = useRef(false);

    // Fetch student data
    const fetchStudentData = useCallback(async () => {
        try {
            const [profileRes, gradesRes, attendanceRes, scheduleRes, analyticsRes] = await Promise.allSettled([
                api.get('/students/me'),
                api.get('/students/me/grades'),
                api.get('/students/me/attendance'),
                api.get('/students/me/schedule'),
                api.get('/analytics/me'),
            ]);

            if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
            if (gradesRes.status === 'fulfilled') setGrades(gradesRes.value.data);
            if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value.data);
            if (scheduleRes.status === 'fulfilled') setSchedule(scheduleRes.value.data);
            if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value.data);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAiInsights = async () => {
        setLoadingInsights(true);
        try {
            const res = await api.get('/analytics/me/ai-insights');
            setAiInsights(res.data);
            try { localStorage.setItem(`sima_insights_${user?.id}`, JSON.stringify(res.data)); } catch { }
        } catch (err) {
            console.error('Erro ao buscar insights:', err);
        } finally {
            setLoadingInsights(false);
        }
    };

    // Fetch sync status
    const fetchSyncStatus = useCallback(async () => {
        try {
            const res = await api.get('/students/me/sync-status');
            setSyncStatus(res.data.sync_status);
            setLastSyncAt(res.data.last_sync_at);
            setSyncError(res.data.sync_error);
            setHasCredentials(res.data.has_lyceum_credentials);
            return res.data;
        } catch (err) {
            console.error('Erro ao verificar status de sync:', err);
            return null;
        }
    }, []);

    // Start sync
    const startSync = async () => {
        try {
            setSyncError(null);
            await api.post('/students/me/sync');
            setSyncStatus('syncing');
            startPolling();
        } catch (err) {
            const detail = err.response?.data?.detail || 'Erro ao iniciar sincronização';
            setSyncError(detail);

            // Se não tem credenciais, mostrar modal
            if (err.response?.status === 400) {
                setShowPasswordModal(true);
            }
        }
    };

    // Submit Lyceum password
    const savePassword = async () => {
        if (!lyceumPassword) return;
        setSavingPassword(true);
        try {
            await api.post('/students/me/lyceum-credentials', { lyceum_password: lyceumPassword });
            setHasCredentials(true);
            setShowPasswordModal(false);
            setLyceumPassword('');
            // After saving password, start sync
            await startSync();
        } catch (err) {
            setSyncError(err.response?.data?.detail || 'Erro ao salvar credenciais');
        } finally {
            setSavingPassword(false);
        }
    };

    // Poll for sync completion
    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            const data = await fetchSyncStatus();
            if (data && data.sync_status !== 'syncing') {
                clearInterval(pollingRef.current);
                pollingRef.current = null;

                // Reload student data after sync completes
                if (data.sync_status === 'done') {
                    fetchStudentData();
                }
            }
        }, 3000); // Poll every 3 seconds
    }, [fetchSyncStatus, fetchStudentData]);

    // Initial load
    useEffect(() => {
        fetchStudentData();
        fetchSyncStatus().then(data => {
            // Auto-sync on first login (no previous sync)
            if (data && !data.last_sync_at && data.has_lyceum_credentials && !autoSyncTriggered.current) {
                autoSyncTriggered.current = true;
                startSync();
            } else if (data && !data.last_sync_at && !data.has_lyceum_credentials && !autoSyncTriggered.current) {
                // No credentials → show modal on first login  
                autoSyncTriggered.current = true;
                setShowPasswordModal(true);
            } else if (data && data.sync_status === 'syncing') {
                startPolling();
            }
        });

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    const formatDate = (iso) => {
        if (!iso) return null;
        const d = new Date(iso);
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getMediaColor = (media) => {
        if (media >= 7) return 'text-accent-emerald';
        if (media >= 5) return 'text-accent-amber';
        return 'text-accent-rose';
    };

    const getPresencaColor = (pct) => {
        if (pct >= 75) return 'text-accent-emerald';
        if (pct >= 50) return 'text-accent-amber';
        return 'text-accent-rose';
    };

    const getRiskBadge = (level) => {
        switch (level) {
            case 'critical': return { label: 'Risco Crítico', color: 'bg-accent-rose/10 text-accent-rose', icon: AlertTriangle };
            case 'high': return { label: 'Risco Alto', color: 'bg-accent-amber/10 text-accent-amber', icon: AlertTriangle };
            case 'medium': return { label: 'Risco Médio', color: 'bg-accent-blue/10 text-accent-blue', icon: Info };
            default: return { label: 'Risco Baixo', color: 'bg-accent-emerald/10 text-accent-emerald', icon: CheckCircle };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
            <PageHeader
                title={`Olá, ${profile?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'Aluno'}!`}
                subtitle="Acompanhe seu desempenho acadêmico"
                icon={GraduationCap}
            />

            {/* ═══ SYNC CARD ═══ */}
            <Card className="p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${syncStatus === 'syncing' ? 'bg-accent-blue/10' :
                            syncStatus === 'done' ? 'bg-accent-emerald/10' :
                                syncStatus === 'error' ? 'bg-accent-rose/10' :
                                    'bg-gray-500/10'
                            }`}>
                            {syncStatus === 'syncing' ? (
                                <RefreshCw className="w-6 h-6 text-accent-blue animate-spin" />
                            ) : syncStatus === 'done' ? (
                                <Wifi className="w-6 h-6 text-accent-emerald" />
                            ) : syncStatus === 'error' ? (
                                <WifiOff className="w-6 h-6 text-accent-rose" />
                            ) : (
                                <Wifi className="w-6 h-6 text-gray-500" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-text-primary">
                                Sincronização Lyceum
                            </h3>
                            {syncStatus === 'syncing' ? (
                                <p className="text-xs text-accent-blue mt-0.5">
                                    ⏳ Sincronizando dados do portal acadêmico...
                                </p>
                            ) : lastSyncAt ? (
                                <p className="text-xs text-text-secondary mt-0.5">
                                    Última sincronização: <span className="text-text-primary font-medium">{formatDate(lastSyncAt)}</span>
                                </p>
                            ) : (
                                <p className="text-xs text-text-secondary mt-0.5">
                                    Nenhuma sincronização realizada
                                </p>
                            )}
                            {syncStatus === 'error' && syncError && (
                                <p className="text-xs text-accent-rose mt-1">
                                    ❌ {syncError}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 ml-auto">
                        {!hasCredentials && (
                            <button
                                onClick={() => setShowPasswordModal(true)}
                                className="px-4 py-2 text-xs rounded-xl border border-accent-amber/20 text-accent-amber hover:bg-accent-amber/10 transition-colors cursor-pointer"
                            >
                                <Lock className="w-3.5 h-3.5 inline mr-1" />
                                Configurar Senha
                            </button>
                        )}
                        <Button
                            onClick={startSync}
                            loading={syncStatus === 'syncing'}
                            disabled={syncStatus === 'syncing' || !hasCredentials}
                            className="px-5 py-2 text-sm"
                            icon={RefreshCw}
                        >
                            {syncStatus === 'syncing' ? 'Sincronizando...' : 'Sincronizar Lyceum'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* ═══ PASSWORD MODAL ═══ */}
            <AnimatePresence>
                {showPasswordModal && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowPasswordModal(false)}
                    >
                        <motion.div
                            className="glass-card p-8 max-w-md w-full mx-4 border-border-subtle"
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-blue to-accent-cyan flex items-center justify-center mx-auto">
                                    <Lock className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="text-lg font-bold mt-4 text-text-primary">Senha do Portal Lyceum</h3>
                                <p className="text-sm text-text-secondary mt-1">
                                    Informe sua senha do portal acadêmico para sincronizar notas, faltas e horários automaticamente.
                                </p>
                            </div>

                            <Input
                                label="Senha do Portal"
                                type="password"
                                placeholder="Digite sua senha do Lyceum"
                                icon={Lock}
                                value={lyceumPassword}
                                onChange={e => setLyceumPassword(e.target.value)}
                            />

                            <p className="text-[11px] text-text-secondary mt-2">
                                🔒 Sua senha é armazenada com segurança e usada apenas para acessar seus dados no portal.
                            </p>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowPasswordModal(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50 transition-colors text-sm cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <Button
                                    onClick={savePassword}
                                    loading={savingPassword}
                                    className="flex-1 py-2.5"
                                    icon={CheckCircle}
                                    disabled={!lyceumPassword}
                                >
                                    Salvar e Sincronizar
                                </Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ═══ QUICK STATS ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-accent-blue" />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Disciplinas</p>
                            <p className="text-xl font-bold text-text-primary">
                                {grades?.total_disciplinas || 0}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-emerald/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-accent-emerald" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-text-secondary">Média Geral</p>
                                {analytics?.kpis?.grade_trend && (
                                    <span className={`text-[10px] flex items-center ${analytics.kpis.grade_trend > 0 ? 'text-accent-emerald' : 'text-accent-rose'}`}>
                                        {analytics.kpis.grade_trend > 0 ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                                        {Math.abs(analytics.kpis.grade_trend).toFixed(1)}
                                    </span>
                                )}
                            </div>
                            <p className="text-xl font-bold text-text-primary">
                                {analytics?.kpis?.beginning_of_semester
                                    ? '—'
                                    : (analytics?.kpis?.gpa?.toFixed(1) || (grades?.grades?.length > 0
                                        ? (grades.grades.reduce((sum, g) => sum + g.media, 0) / grades.grades.length).toFixed(1)
                                        : '0.0'))}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-accent-amber" />
                        </div>
                        <div>
                            <p className="text-sm text-text-secondary">Frequência</p>
                            <p className={`text-xl font-bold ${getPresencaColor(analytics?.kpis?.attendance_rate || 100)}`}>
                                {(analytics?.kpis?.attendance_rate || 0).toFixed(0)}%
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        {(() => {
                            const badge = getRiskBadge(analytics?.kpis?.risk_level);
                            const Icon = badge.icon;
                            return (
                                <>
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${badge.color}`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-text-secondary">Status de Risco</p>
                                        <p className="text-sm font-bold text-text-primary uppercase tracking-wider">
                                            {badge.label}
                                        </p>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                    {/* Progress bar background */}
                    <div className="absolute bottom-0 left-0 h-1 bg-accent-blue/20 transition-all duration-1000" style={{ width: `${(analytics?.kpis?.risk_score || 0) * 100}%` }} />
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ═══ AI INSIGHTS & RECOMMENDATIONS ═══ */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Insights IA */}
                    <Card className="p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                            <Sparkles className="w-24 h-24 text-accent-blue" />
                        </div>

                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                                <Brain className="w-5 h-5 text-accent-blue" />
                                Insights Inteligentes
                            </h3>
                            <button
                                onClick={fetchAiInsights}
                                disabled={loadingInsights}
                                className="text-xs text-accent-blue hover:text-accent-blue-light flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <RefreshCw className={`w-3 h-3 ${loadingInsights ? 'animate-spin' : ''}`} />
                                Atualizar Insights
                            </button>
                        </div>

                        {loadingInsights ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-4">
                                <div className="w-10 h-10 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-text-secondary animate-pulse">O Gemini está analisando seu perfil acadêmico...</p>
                            </div>
                        ) : aiInsights && !aiInsights.error ? (
                            <div className="space-y-5">
                                {/* Summary */}
                                <motion.div
                                    className="bg-bg-elevated/40 rounded-xl p-5 border border-border-subtle/30"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <div className="flex gap-4">
                                        <div className="mt-1">
                                            <Sparkles className="w-5 h-5 text-accent-amber" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                                                {aiInsights.summary || "Nenhum insight disponível no momento."}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Strengths & Alerts Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Strengths */}
                                    {aiInsights.strengths?.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-[10px] uppercase tracking-wider text-accent-emerald font-bold flex items-center gap-1.5">
                                                <CheckCircle className="w-3 h-3" /> Pontos Fortes
                                            </p>
                                            {aiInsights.strengths.map((s, i) => (
                                                <motion.div
                                                    key={i}
                                                    className="p-3 rounded-xl bg-accent-emerald/5 border border-accent-emerald/10"
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                >
                                                    <p className="text-xs font-semibold text-accent-emerald mb-0.5">{s.title}</p>
                                                    <p className="text-xs text-text-secondary leading-relaxed">{s.description}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Alerts */}
                                    {aiInsights.alerts?.length > 0 && (
                                        <div className="space-y-3">
                                            <p className="text-[10px] uppercase tracking-wider text-accent-amber font-bold flex items-center gap-1.5">
                                                <AlertTriangle className="w-3 h-3" /> Pontos de Atenção
                                            </p>
                                            {aiInsights.alerts.map((a, i) => (
                                                <motion.div
                                                    key={i}
                                                    className={`p-3 rounded-xl border ${a.severity === 'high' ? 'bg-accent-rose/5 border-accent-rose/10' :
                                                        a.severity === 'medium' ? 'bg-accent-amber/5 border-accent-amber/10' :
                                                            'bg-accent-blue/5 border-accent-blue/10'
                                                        }`}
                                                    initial={{ opacity: 0, x: 10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                >
                                                    <p className={`text-xs font-semibold mb-0.5 ${a.severity === 'high' ? 'text-accent-rose' :
                                                        a.severity === 'medium' ? 'text-accent-amber' :
                                                            'text-accent-blue'
                                                        }`}>{a.title}</p>
                                                    <p className="text-xs text-text-secondary leading-relaxed">{a.description}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Study Tips */}
                                {aiInsights.study_tips?.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-[10px] uppercase tracking-wider text-accent-blue font-bold flex items-center gap-1.5">
                                            <Lightbulb className="w-3 h-3" /> Dicas de Estudo
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {aiInsights.study_tips.map((tip, i) => (
                                                <motion.div
                                                    key={i}
                                                    className="p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                >
                                                    <p className="text-xs font-semibold text-accent-blue mb-0.5">{tip.title}</p>
                                                    <p className="text-xs text-text-secondary leading-relaxed">{tip.description}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Motivation */}
                                {aiInsights.motivation && (
                                    <motion.div
                                        className="text-center py-4 px-6 rounded-xl bg-gradient-to-r from-accent-purple/5 via-accent-blue/5 to-accent-cyan/5 border border-accent-purple/10"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        <p className="text-sm text-text-primary italic leading-relaxed">
                                            "{aiInsights.motivation}"
                                        </p>
                                        <p className="text-[10px] text-text-secondary mt-2 uppercase tracking-wider">
                                            ✨ Gemini • {aiInsights.model || 'IA'}
                                        </p>
                                    </motion.div>
                                )}
                            </div>

                        ) : (
                            <div className="py-12 text-center border-2 border-dashed border-border-subtle rounded-2xl">
                                <Sparkles className="w-10 h-10 text-gray-600 mx-auto mb-3 opacity-20" />
                                <p className="text-sm text-text-secondary">Descubra padrões e predições exclusivas sobre seus estudos.</p>
                                <button
                                    onClick={fetchAiInsights}
                                    className="mt-4 text-sm font-medium text-accent-blue hover:underline cursor-pointer"
                                >
                                    Gerar Primeiro Insight
                                </button>
                            </div>
                        )}
                    </Card>

                    {/* Recomendações */}
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-accent-amber" />
                            Plano de Ação Estratégico
                        </h3>

                        <div className="space-y-4">
                            {analytics?.kpis?.beginning_of_semester ? (
                                <div className="py-8 text-center bg-accent-blue/5 border border-accent-blue/15 rounded-xl">
                                    <BookOpen className="w-8 h-8 text-accent-blue mx-auto mb-2 opacity-50" />
                                    <p className="text-sm font-medium text-text-primary">Início de Período</p>
                                    <p className="text-xs text-text-secondary mt-1">Ainda não há notas lançadas neste semestre. As recomendações aparecerão assim que as primeiras avaliações forem registradas.</p>
                                </div>
                            ) : analytics?.recommendations?.length > 0 ? (
                                analytics.recommendations.map((rec, i) => (
                                    <motion.div
                                        key={i}
                                        className={`p-4 rounded-xl border flex gap-4 ${rec.priority === 'critical' ? 'bg-accent-rose/5 border-accent-rose/20' :
                                            rec.priority === 'high' ? 'bg-accent-amber/5 border-accent-amber/20' :
                                                'bg-bg-elevated/50 border-border-subtle'
                                            }`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${rec.priority === 'critical' ? 'bg-accent-rose/10 text-accent-rose' :
                                            rec.priority === 'high' ? 'bg-accent-amber/10 text-accent-amber' :
                                                'bg-accent-blue/10 text-accent-blue'
                                            }`}>
                                            <Info className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-text-primary mb-1">{rec.title}</h4>
                                            <p className="text-xs text-text-secondary leading-relaxed">{rec.message}</p>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="py-8 text-center bg-bg-elevated/20 rounded-xl">
                                    <CheckCircle className="w-8 h-8 text-accent-emerald mx-auto mb-2 opacity-30" />
                                    <p className="text-sm text-text-secondary">Você está com tudo em ordem! Continue assim.</p>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">


                    {/* Frequência (Mini) */}
                    <Card className="p-5">
                        <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-accent-emerald" />
                            Atenção à Frequência
                        </h3>
                        <div className="space-y-4">
                            {attendance?.attendance?.length > 0 ? (
                                attendance.attendance.filter(a => a.percentual_presenca < 85).slice(0, 3).map((a, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-[11px] mb-1.5">
                                            <span className="text-text-primary truncate pr-2">{a.disciplina}</span>
                                            <span className={`font-bold ${getPresencaColor(a.percentual_presenca)}`}>
                                                {a.percentual_presenca?.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="h-1 bg-bg-elevated rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${a.percentual_presenca < 75 ? 'bg-accent-rose' : 'bg-accent-amber'
                                                    }`}
                                                style={{ width: `${a.percentual_presenca}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            ) : null}
                            {(!attendance?.attendance || attendance?.attendance?.filter(a => a.percentual_presenca < 85).length === 0) && (
                                <p className="text-xs text-accent-emerald bg-accent-emerald/5 p-3 rounded-lg flex items-center gap-2">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Presença excelente em tudo!
                                </p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            {/* ═══ GRADES TABLE ═══ */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-accent-blue" />
                    Notas por Disciplina
                </h3>
                {grades?.grades?.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-text-secondary border-b border-border-subtle">
                                    <th className="text-left py-3 pr-4">Disciplina</th>
                                    <th className="text-center py-3 px-2">VA1</th>
                                    <th className="text-center py-3 px-2">VA2</th>
                                    <th className="text-center py-3 px-2">VA3</th>
                                    <th className="text-center py-3 px-2">Média</th>
                                    <th className="text-center py-3 px-2">Situação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grades.grades.map((g, i) => (
                                    <motion.tr
                                        key={i}
                                        className="border-b border-border-subtle/50 hover:bg-bg-elevated/30 transition-colors"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <td className="py-3 pr-4 text-text-primary font-medium">{g.disciplina}</td>
                                        <td className="py-3 px-2 text-center text-text-secondary">{g.va1?.toFixed(1) || '—'}</td>
                                        <td className="py-3 px-2 text-center text-text-secondary">{g.va2?.toFixed(1) || '—'}</td>
                                        <td className="py-3 px-2 text-center text-text-secondary">{g.va3?.toFixed(1) || '—'}</td>
                                        <td className={`py-3 px-2 text-center font-bold ${getMediaColor(g.media)}`}>
                                            {g.media?.toFixed(1)}
                                        </td>
                                        <td className="py-3 px-2 text-center">
                                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${g.situacao === 'Aprovado' ? 'bg-accent-emerald/10 text-accent-emerald' :
                                                g.situacao === 'Reprovado' ? 'bg-accent-rose/10 text-accent-rose' :
                                                    'bg-accent-amber/10 text-accent-amber'
                                                }`}>
                                                {g.situacao === 'Aprovado' ? <CheckCircle className="w-3 h-3" /> :
                                                    g.situacao === 'Reprovado' ? <AlertTriangle className="w-3 h-3" /> :
                                                        <Clock className="w-3 h-3" />}
                                                {g.situacao}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-text-secondary">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Nenhuma nota disponível ainda</p>
                        <p className="text-xs mt-1">Clique em "Sincronizar Lyceum" para importar seus dados</p>
                    </div>
                )}
            </Card>

            {/* ═══ ATTENDANCE ═══ */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-accent-emerald" />
                    Frequência por Disciplina
                </h3>
                {attendance?.attendance?.length > 0 ? (
                    <div className="space-y-3">
                        {attendance.attendance.map((a, i) => (
                            <motion.div
                                key={i}
                                className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated/30 border border-border-subtle/50"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <span className="text-sm text-text-primary">{a.disciplina}</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-text-secondary">
                                        {a.total_faltas} faltas / {a.total_aulas} aulas
                                    </span>
                                    <span className={`text-sm font-bold ${getPresencaColor(a.percentual_presenca)}`}>
                                        {a.percentual_presenca?.toFixed(0)}%
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-text-secondary">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum dado de frequência disponível</p>
                    </div>
                )}
            </Card>


        </motion.div>
    );
}
