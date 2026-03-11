import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Search, UserPlus, Users, ChevronRight, Mail, Calendar, Hash } from 'lucide-react';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import api from '@/services/api';
import clsx from 'clsx';

const statusMap = {
    ACTIVE: { label: 'Ativo', variant: 'success', dot: true },
    INACTIVE: { label: 'Inativo', variant: 'neutral', dot: false },
    GRADUATED: { label: 'Graduado', variant: 'info', dot: false },
    active: { label: 'Ativo', variant: 'success', dot: true },
};

export function StudentsList() {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        fetchStudents();
    }, [search]);

    const fetchStudents = async () => {
        try {
            const query = search ? `?search=${search}` : '';
            const response = await api.get(`/students/${query}`);
            setStudents(response.data.students || []);
        } catch (error) {
            console.error("Erro ao buscar alunos", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <PageHeader
                    title="Alunos"
                    subtitle="Gerenciamento da base de discentes"
                    icon={Users}
                />
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <Button icon={UserPlus} size="md">Novo Aluno</Button>
                </motion.div>
            </div>

            <Card animate={true} delay={0.15} className="p-0 overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-border-subtle bg-white/[0.02]">
                    <Input
                        placeholder="Buscar por nome ou matrícula..."
                        icon={Search}
                        className="max-w-md"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-white/[0.02] border-b border-border-subtle">
                                <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Nome</th>
                                <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Matrícula</th>
                                <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Email</th>
                                <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Status</th>
                                <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Data Matrícula</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="border-b border-border-subtle/50">
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <div className={clsx("h-4 bg-white/5 rounded-md animate-pulse", j === 0 ? "w-36" : j === 5 ? "w-8" : "w-24")} />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : students.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 rounded-2xl bg-white/[0.03] text-gray-600">
                                                <Users className="w-8 h-8" />
                                            </div>
                                            <p className="text-gray-500 font-medium">Nenhum aluno encontrado</p>
                                            <p className="text-xs text-gray-600">Tente ajustar sua busca ou adicionar novos alunos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                students.map((student, index) => {
                                    const status = statusMap[student.status] || statusMap.inactive;
                                    return (
                                        <motion.tr
                                            key={student.id}
                                            className="border-b border-border-subtle/50 hover:bg-white/[0.02] transition-colors duration-200 group cursor-pointer"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.03, duration: 0.3 }}
                                            onClick={() => setSelectedStudentId(student.id)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center text-xs font-bold text-accent-blue-light">
                                                        {student.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-gray-200">{student.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-gray-400 font-mono text-xs bg-white/[0.03] px-2 py-1 rounded">
                                                    {student.registration_number}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-400">{student.email}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={status.variant} dot={status.dot}>
                                                    {status.label}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-xs">
                                                {new Date(student.enrollment_date).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <ChevronRight className="w-4 h-4 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Student Detail Modal */}
            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={selectedStudentId !== null}
                onClose={() => setSelectedStudentId(null)}
            />
        </div>
    );
}
