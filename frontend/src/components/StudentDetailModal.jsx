import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, User, BookOpen, Clock, Award, TrendingUp,
    CheckCircle, AlertTriangle, XCircle, GraduationCap, Mail, Hash, Calendar
} from 'lucide-react';
import api from '@/services/api';
import clsx from 'clsx';

const situacaoConfig = {
    'Aprovado': { color: 'text-emerald-400', bg: 'bg-emerald-400/10', icon: CheckCircle },
    'Reprovado': { color: 'text-red-400', bg: 'bg-red-400/10', icon: XCircle },
    'Cursando': { color: 'text-blue-400', bg: 'bg-blue-400/10', icon: BookOpen },
    'default': { color: 'text-amber-400', bg: 'bg-amber-400/10', icon: AlertTriangle },
};

function getGradeColor(value) {
    if (value === null || value === undefined || value === 0) return 'text-gray-500';
    if (value >= 7) return 'text-emerald-400';
    if (value >= 5) return 'text-amber-400';
    return 'text-red-400';
}

function getPresenceColor(pct) {
    if (pct >= 75) return 'text-emerald-400';
    if (pct >= 60) return 'text-amber-400';
    return 'text-red-400';
}

function getPresenceBg(pct) {
    if (pct >= 75) return 'bg-emerald-400';
    if (pct >= 60) return 'bg-amber-400';
    return 'bg-red-400';
}

export function StudentDetailModal({ studentId, isOpen, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('grades');

    useEffect(() => {
        if (isOpen && studentId) {
            setLoading(true);
            setActiveTab('grades');
            api.get(`/students/${studentId}/detail`)
                .then(res => setData(res.data))
                .catch(err => console.error('Erro ao buscar detalhes do aluno', err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, studentId]);

    // Close on ESC key
    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const tabs = [
        { id: 'grades', label: 'Notas', icon: Award },
        { id: 'attendance', label: 'Frequência', icon: Clock },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        className="fixed right-0 top-0 h-full w-full max-w-2xl z-[101] flex flex-col"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    >
                        <div className="h-full flex flex-col bg-[#0f1117] border-l border-white/10 shadow-2xl">
                            {/* Header */}
                            {loading ? (
                                <div className="p-6 border-b border-white/10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-2xl bg-white/5 animate-pulse" />
                                        <div className="flex-1">
                                            <div className="h-5 w-48 bg-white/5 rounded animate-pulse mb-2" />
                                            <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
                                        </div>
                                    </div>
                                </div>
                            ) : data && (
                                <div className="p-6 border-b border-white/10 bg-gradient-to-r from-accent-blue/5 to-accent-purple/5">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-accent-blue/10">
                                                {data.student.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold text-white">{data.student.name}</h2>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <Hash className="w-3 h-3" />
                                                        {data.student.registration_number}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <GraduationCap className="w-3 h-3" />
                                                        {data.student.course_name}
                                                    </span>
                                                </div>
                                                {data.student.email && (
                                                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                                        <Mail className="w-3 h-3" />
                                                        {data.student.email}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-3 gap-3 mt-5">
                                        <QuickStat
                                            label="Disciplinas"
                                            value={data.grades?.length || 0}
                                            icon={BookOpen}
                                            color="blue"
                                        />
                                        <QuickStat
                                            label="Média Geral"
                                            value={
                                                data.grades?.length > 0
                                                    ? (data.grades.reduce((sum, g) => sum + (g.media || 0), 0) / data.grades.length).toFixed(1)
                                                    : '—'
                                            }
                                            icon={TrendingUp}
                                            color="emerald"
                                        />
                                        <QuickStat
                                            label="Freq. Média"
                                            value={
                                                data.attendance?.length > 0
                                                    ? (data.attendance.reduce((sum, a) => sum + (a.percentual_presenca || 0), 0) / data.attendance.length).toFixed(0) + '%'
                                                    : '—'
                                            }
                                            icon={Clock}
                                            color="purple"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Tabs */}
                            <div className="flex gap-1 px-6 pt-4 pb-0">
                                {tabs.map(tab => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={clsx(
                                                'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-medium transition-all',
                                                activeTab === tab.id
                                                    ? 'bg-white/[0.06] text-white border-b-2 border-accent-blue'
                                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                                            )}
                                        >
                                            <Icon className="w-4 h-4" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin">
                                {loading ? (
                                    <div className="space-y-3">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <div key={i} className="h-20 bg-white/[0.03] rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : (
                                    <AnimatePresence mode="wait">
                                        {activeTab === 'grades' && (
                                            <GradesTab key="grades" grades={data?.grades || []} />
                                        )}
                                        {activeTab === 'attendance' && (
                                            <AttendanceTab key="attendance" attendance={data?.attendance || []} />
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function QuickStat({ label, value, icon: Icon, color }) {
    const colorMap = {
        blue: 'from-accent-blue/20 to-accent-blue/5 text-accent-blue',
        emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
        purple: 'from-accent-purple/20 to-accent-purple/5 text-accent-purple',
    };
    return (
        <div className={clsx(
            'p-3 rounded-xl bg-gradient-to-br border border-white/5',
            colorMap[color]
        )}>
            <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 opacity-70" />
                <span className="text-[10px] uppercase tracking-wider opacity-70 font-medium">{label}</span>
            </div>
            <div className="text-xl font-bold text-white ml-0.5">{value}</div>
        </div>
    );
}

function GradesTab({ grades }) {
    if (grades.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-16 text-gray-500"
            >
                <Award className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium">Nenhuma nota encontrada</p>
                <p className="text-xs text-gray-600 mt-1">Os dados de notas serão exibidos após a sincronização</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
        >
            {grades.map((grade, index) => {
                const situacao = situacaoConfig[grade.situacao] || situacaoConfig['default'];
                const SitIcon = situacao.icon;
                return (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-accent-blue" />
                                <span className="text-sm font-semibold text-gray-200 line-clamp-1">
                                    {grade.disciplina}
                                </span>
                            </div>
                            <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', situacao.bg, situacao.color)}>
                                <SitIcon className="w-3 h-3" />
                                {grade.situacao || '—'}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <GradeCell label="VA1" value={grade.va1} />
                            <GradeCell label="VA2" value={grade.va2} />
                            <GradeCell label="VA3" value={grade.va3} />
                            <GradeCell label="Média" value={grade.media} highlight />
                        </div>
                    </motion.div>
                );
            })}
        </motion.div>
    );
}

function GradeCell({ label, value, highlight = false }) {
    const displayValue = value !== null && value !== undefined && value > 0 ? value.toFixed(1) : '—';
    return (
        <div className={clsx(
            'text-center p-2 rounded-lg',
            highlight ? 'bg-white/[0.05] border border-white/10' : 'bg-white/[0.02]'
        )}>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">{label}</div>
            <div className={clsx(
                'text-base font-bold',
                highlight ? getGradeColor(value) : 'text-gray-300',
                highlight && 'text-lg'
            )}>
                {displayValue}
            </div>
        </div>
    );
}

function AttendanceTab({ attendance }) {
    if (attendance.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-16 text-gray-500"
            >
                <Clock className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium">Nenhuma frequência encontrada</p>
                <p className="text-xs text-gray-600 mt-1">Os dados de frequência serão exibidos após a sincronização</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
        >
            {attendance.map((att, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors"
                >
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-accent-purple" />
                            <span className="text-sm font-semibold text-gray-200 line-clamp-1">
                                {att.disciplina}
                            </span>
                        </div>
                        <span className={clsx('text-lg font-bold', getPresenceColor(att.percentual_presenca))}>
                            {att.percentual_presenca?.toFixed(0)}%
                        </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden mb-2">
                        <motion.div
                            className={clsx('h-full rounded-full', getPresenceBg(att.percentual_presenca))}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(att.percentual_presenca, 100)}%` }}
                            transition={{ delay: index * 0.05 + 0.2, duration: 0.6, ease: 'easeOut' }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{att.total_aulas} aulas</span>
                        <span className="text-red-400/80">{att.total_faltas} faltas</span>
                    </div>
                </motion.div>
            ))}
        </motion.div>
    );
}
