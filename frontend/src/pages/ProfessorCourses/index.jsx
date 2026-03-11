import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import api from '@/services/api';
import {
    BookOpen, Plus, X, Check, Search, Users,
    GraduationCap, Loader2, Save, CheckCircle
} from 'lucide-react';

export function ProfessorCourses() {
    const { user } = useAuth();
    const [profile, setProfile] = useState(null);
    const [availableCourses, setAvailableCourses] = useState([]);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [subjectStudents, setSubjectStudents] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [profileRes, coursesRes, studentsRes] = await Promise.allSettled([
                    api.get('/professors/me'),
                    api.get('/courses/available'),
                    api.get('/professors/me/students'),
                ]);

                if (profileRes.status === 'fulfilled') {
                    setProfile(profileRes.value.data);
                    const ids = new Set(profileRes.value.data.courses?.map(c => c.id) || []);
                    setSelectedIds(ids);
                }
                if (coursesRes.status === 'fulfilled') {
                    setAvailableCourses(coursesRes.value.data);
                }
                if (studentsRes.status === 'fulfilled') {
                    setSubjectStudents(studentsRes.value.data);
                }
            } catch (err) {
                console.error('Erro ao carregar dados:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const toggleCourse = (courseId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(courseId)) {
                next.delete(courseId);
            } else {
                next.add(courseId);
            }
            return next;
        });
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.put('/professors/me/courses', {
                course_ids: Array.from(selectedIds),
            });
            setProfile(prev => ({ ...prev, courses: res.data.courses }));
            setSaved(true);

            // Recarregar alunos
            const studentsRes = await api.get('/professors/me/students');
            setSubjectStudents(studentsRes.data);

            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            console.error('Erro ao salvar cursos:', err);
        } finally {
            setSaving(false);
        }
    };

    const filteredCourses = availableCourses.filter(c => {
        const searchLower = search.toLowerCase().trim();
        if (!searchLower) return true;

        return (
            c.name.toLowerCase().includes(searchLower) ||
            c.code.toLowerCase().includes(searchLower) ||
            (c.department || '').toLowerCase().includes(searchLower)
        );
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Agrupar por department
    const grouped = {};
    filteredCourses.forEach(c => {
        const dept = c.department || 'Outros';
        if (!grouped[dept]) grouped[dept] = [];
        grouped[dept].push(c);
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
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
                title="Minhas Disciplinas"
                subtitle="Selecione quais disciplinas você leciona para ver os dados dos seus alunos"
                icon={BookOpen}
            />

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent-purple/10 text-accent-purple-light">
                        <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Disciplinas Selecionadas</p>
                        <p className="text-xl font-bold text-accent-purple-light">{selectedIds.size}</p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent-blue/10 text-accent-blue-light">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Total de Alunos</p>
                        <p className="text-xl font-bold text-accent-blue-light">
                            {subjectStudents.reduce((sum, s) => sum + s.students.length, 0)}
                        </p>
                    </div>
                </Card>
                <Card className="p-4 flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent-emerald/10 text-accent-emerald">
                        <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Disponíveis</p>
                        <p className="text-xl font-bold text-accent-emerald">{availableCourses.length}</p>
                    </div>
                </Card>
            </div>

            {/* Search + Save */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar disciplina por nome, código ou departamento..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-bg-elevated/60 border border-border-subtle text-text-primary text-sm rounded-xl focus:outline-none focus:border-accent-purple/60 transition-colors placeholder:text-gray-600"
                    />
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 bg-gradient-to-r from-accent-purple to-accent-blue text-white hover:shadow-glow-sm disabled:opacity-50 cursor-pointer"
                >
                    {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : saved ? (
                        <CheckCircle className="w-4 h-4" />
                    ) : (
                        <Save className="w-4 h-4" />
                    )}
                    {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Disciplinas'}
                </button>
            </div>

            {/* Course Grid */}
            {Object.entries(grouped).map(([dept, courses]) => (
                <div key={dept} className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">{dept}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {courses.map((course) => {
                            const isSelected = selectedIds.has(course.id);
                            const studentCount = subjectStudents.find(s => s.course_id === course.id)?.students?.length || 0;

                            return (
                                <motion.button
                                    key={course.id}
                                    onClick={() => toggleCourse(course.id)}
                                    className={`p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer group ${isSelected
                                        ? 'bg-accent-purple/8 border-accent-purple/30 shadow-glow-purple/10'
                                        : 'bg-bg-secondary/50 border-border-subtle hover:border-border-hover'
                                        }`}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono text-gray-500 bg-bg-elevated/50 px-2 py-0.5 rounded">
                                                    {course.code}
                                                </span>
                                                {isSelected && studentCount > 0 && (
                                                    <span className="text-[10px] text-accent-blue-light bg-accent-blue/10 px-2 py-0.5 rounded">
                                                        {studentCount} alunos
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-accent-purple-light' : 'text-text-primary'}`}>
                                                {course.name}
                                            </p>
                                        </div>
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isSelected
                                            ? 'bg-accent-purple text-white'
                                            : 'bg-bg-elevated/50 text-gray-600 group-hover:text-gray-400'
                                            }`}>
                                            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                        </div>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            ))}

            {filteredCourses.length === 0 && (
                <Card className="p-8 text-center border-dashed border-border-subtle bg-transparent">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-text-secondary opacity-30" />
                    {search ? (
                        <p className="text-text-secondary">Nenhuma disciplina encontrada para sua busca.</p>
                    ) : profile?.academic_courses?.length === 0 ? (
                        <div className="space-y-4">
                            <p className="text-text-secondary">
                                Você ainda não selecionou nenhum **Curso Acadêmico** no seu perfil.
                            </p>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                Para ver as disciplinas disponíveis, primeiro vá em seu perfil e selecione os cursos em que você atua (ex: Inteligência Artificial).
                            </p>
                            <Link to="/professor/profile">
                                <button className="mt-2 px-4 py-2 rounded-lg bg-accent-purple/10 text-accent-purple-light hover:bg-accent-purple/20 transition-colors text-sm font-medium">
                                    Ir para Meu Perfil
                                </button>
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-text-secondary">
                                Nenhuma disciplina encontrada para os cursos selecionados:
                                <span className="text-accent-purple-light block mt-1 font-medium">
                                    {profile?.academic_courses?.join(', ')}
                                </span>
                            </p>
                            <p className="text-xs text-gray-500 max-w-sm mx-auto">
                                Isso acontece quando não há alunos cadastrados com matérias para estes cursos no momento.
                            </p>
                        </div>
                    )}
                </Card>
            )}
        </motion.div>
    );
}
