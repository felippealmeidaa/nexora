import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import {
    Database, Upload, Search, Filter, Calendar,
    BookOpen, User, Hash, AlertCircle, CheckCircle2, Loader2,
    FileSpreadsheet, MessageSquare, Send, Bot, Sparkles, X, FileCheck,
    Lightbulb, TrendingUp, BarChart3
} from 'lucide-react';
import api from '@/services/api';
import clsx from 'clsx';

export function HistoricalData() {
    const [records, setRecords] = useState([]);
    const [filters, setFilters] = useState({ semesters: [], courses: [], subjects: [] });
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 50;
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);

    // ── Upload Chat state (opens when file is selected, before upload) ──
    const [showUploadChat, setShowUploadChat] = useState(false);
    const [pendingFile, setPendingFile] = useState(null);
    const [pendingFileContent, setPendingFileContent] = useState('');
    const [uploadChatMessages, setUploadChatMessages] = useState([]);
    const [uploadChatInput, setUploadChatInput] = useState('');
    const [uploadChatLoading, setUploadChatLoading] = useState(false);
    const uploadChatEndRef = useRef(null);
    const uploadChatInputRef = useRef(null);

    // ── General Chat IA state (for already uploaded data) ──
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);
    const chatInputRef = useRef(null);

    // ── Insights state ──
    const [showInsights, setShowInsights] = useState(false);
    const [insightsMessages, setInsightsMessages] = useState([]);
    const [insightsInput, setInsightsInput] = useState('');
    const [insightsLoading, setInsightsLoading] = useState(false);
    const insightsEndRef = useRef(null);
    const insightsInputRef = useRef(null);

    useEffect(() => {
        fetchFilters();
        setCurrentPage(1);
    }, [selectedSemester, selectedCourse, selectedSubject]);

    useEffect(() => {
        fetchRecords();
    }, [selectedSemester, selectedCourse, selectedSubject, currentPage]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);
    useEffect(() => { insightsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [insightsMessages]);
    useEffect(() => { uploadChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [uploadChatMessages]);

    const fetchFilters = async () => {
        try {
            const response = await api.get('/historical-data/filters');
            setFilters(response.data);
        } catch (error) {
            console.error("Erro ao buscar filtros", error);
        }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            let url = '/historical-data';
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('page_size', pageSize.toString());
            if (selectedSemester) params.append('semester', selectedSemester);
            if (selectedCourse) params.append('course_name', selectedCourse);
            if (selectedSubject) params.append('subject', selectedSubject);
            url += `?${params.toString()}`;
            const response = await api.get(url);
            setRecords(response.data?.records || []);
            setTotalCount(response.data?.total_count || 0);
        } catch (error) {
            console.error("Erro ao buscar registros históricos", error);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    // ═══ FILE SELECTION (does NOT upload — opens chat first) ═══
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setPendingFile(file);

        // Read file content for chat context (only for text-based files)
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['csv', 'txt'].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPendingFileContent(e.target.result?.substring(0, 10000) || '');
            };
            reader.readAsText(file);
        } else {
            setPendingFileContent(`[Arquivo binário: ${file.name}]`);
        }

        // Open upload chat automatically
        setShowUploadChat(true);
        setShowChat(false);
        setShowInsights(false);
        setUploadChatMessages([{
            role: 'assistant',
            content: `📎 Arquivo "${file.name}" selecionado!\n\nAntes de carregar, você pode me dar recomendações específicas sobre como processar esta planilha. Por exemplo:\n\n• "Organize apenas por semestre 2024-1"\n• "Ignore as colunas de observação"\n• "Considere apenas alunos do curso de IA"\n• "Separe por disciplina"\n\nOu clique diretamente em **"Carregar Planilha"** para processar sem instruções específicas.`
        }]);

        // Reset input
        event.target.value = '';
    };

    // ═══ ACTUAL UPLOAD (triggered by green button) ═══
    const handleUpload = async () => {
        if (!pendingFile || uploading) return;

        setUploading(true);
        setUploadStatus({ type: 'info', message: 'IA analisando e organizando sua planilha...' });

        const formData = new FormData();
        formData.append('file', pendingFile);

        try {
            const response = await api.post('/historical-data/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUploadStatus({
                type: 'success',
                message: `${response.data.records_count} registros de ${response.data.semester} processados com sucesso!`
            });

            // Add success message to upload chat
            setUploadChatMessages(prev => [...prev, {
                role: 'assistant',
                content: `✅ Planilha carregada com sucesso! ${response.data.records_count} registros foram processados do semestre ${response.data.semester}.\n\nOs dados já estão disponíveis na tabela. Você pode fechar este chat ou continuar fazendo perguntas sobre a planilha.`
            }]);

            fetchFilters();
            fetchRecords();
            setPendingFile(null);

            setTimeout(() => setUploadStatus(null), 5000);
        } catch (error) {
            console.error("Erro no upload", error);
            setUploadStatus({
                type: 'error',
                message: error.response?.data?.detail || 'Erro ao processar planilha. Verifique o formato.'
            });
        } finally {
            setUploading(false);
        }
    };

    // ═══ UPLOAD CHAT (pre-upload recommendations about selected file) ═══
    const sendUploadChatMessage = async () => {
        if (!uploadChatInput.trim() || uploadChatLoading) return;

        const userMessage = uploadChatInput.trim();
        setUploadChatInput('');
        setUploadChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setUploadChatLoading(true);

        try {
            const response = await api.post('/historical-data/chat', {
                message: userMessage,
                file_content: pendingFileContent,
                history: uploadChatMessages.map(m => ({ role: m.role, content: m.content })),
            });
            setUploadChatMessages(prev => [...prev, {
                role: 'assistant',
                content: response.data.response
            }]);
        } catch (error) {
            setUploadChatMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Erro ao processar. Tente novamente.'
            }]);
        } finally {
            setUploadChatLoading(false);
            uploadChatInputRef.current?.focus();
        }
    };

    const handleUploadChatKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendUploadChatMessage();
        }
    };

    // ═══ GENERAL CHAT IA (for data already in the system) ═══
    const sendChatMessage = async () => {
        if (!chatInput.trim() || chatLoading) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setChatLoading(true);

        try {
            const response = await api.post('/historical-data/insights', {
                message: userMessage,
            });
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: response.data.response
            }]);
        } catch (error) {
            setChatMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Erro ao processar. Verifique se há dados históricos carregados.'
            }]);
        } finally {
            setChatLoading(false);
            chatInputRef.current?.focus();
        }
    };

    const handleChatKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    };

    const openChat = () => {
        setShowChat(true);
        setShowInsights(false);
        setShowUploadChat(false);
        if (chatMessages.length === 0) {
            setChatMessages([{
                role: 'assistant',
                content: '👋 Olá! Sou seu assistente para gerenciar os dados históricos.\n\nPosso ajudar você a:\n• Alterar ou corrigir dados de planilhas já carregadas\n• Consultar informações específicas dos registros\n• Analisar padrões nos dados existentes\n• Sugerir organização e tratamento de dados\n\nComo posso ajudar?'
            }]);
        }
    };

    // ═══ INSIGHTS FUNCTIONS ═══
    const sendInsightsMessage = async (customMessage) => {
        const userMessage = customMessage || insightsInput.trim();
        if (!userMessage || insightsLoading) return;

        setInsightsInput('');
        if (!customMessage) {
            setInsightsMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        }
        setInsightsLoading(true);

        try {
            const response = await api.post('/historical-data/insights', {
                message: userMessage,
            });
            setInsightsMessages(prev => [...prev, {
                role: 'assistant',
                content: response.data.response
            }]);
        } catch (error) {
            setInsightsMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Erro ao gerar insights. Verifique se há dados históricos carregados.'
            }]);
        } finally {
            setInsightsLoading(false);
            insightsInputRef.current?.focus();
        }
    };

    const handleInsightsKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendInsightsMessage();
        }
    };

    const startInsights = () => {
        setShowInsights(true);
        setShowChat(false);
        setShowUploadChat(false);
        if (insightsMessages.length === 0) {
            setInsightsMessages([{
                role: 'assistant',
                content: '🔍 Analisando todos os dados históricos...'
            }]);
            setTimeout(() => sendInsightsMessage('Gere uma análise geral completa dos dados históricos.'), 100);
        }
    };

    // ═══ RENDER ═══
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <PageHeader
                    title="Dados Históricos"
                    subtitle="Análise inteligente de dados de semestres passados"
                    icon={Database}
                />

                <div className="flex items-center gap-3">
                    {/* Chat IA — General assistant for existing data */}
                    <Button
                        icon={MessageSquare}
                        variant={showChat ? "primary" : "secondary"}
                        onClick={openChat}
                        className={clsx(
                            "relative",
                            showChat && "ring-2 ring-accent-blue/30"
                        )}
                    >
                        Chat IA
                    </Button>

                    {/* Insights Button */}
                    <Button
                        icon={Lightbulb}
                        variant={showInsights ? "primary" : "secondary"}
                        onClick={startInsights}
                        className={clsx(
                            "relative",
                            showInsights && "ring-2 ring-amber-400/30"
                        )}
                    >
                        Gerar Insights
                    </Button>

                    {/* Upload Button */}
                    <div className="relative">
                        <input
                            type="file"
                            id="historical-upload"
                            className="hidden"
                            accept=".csv,.xlsx,.xls,.txt,.pdf"
                            onChange={handleFileSelect}
                            disabled={uploading}
                        />
                        {pendingFile ? (
                            <Button
                                icon={uploading ? Loader2 : FileCheck}
                                variant="primary"
                                onClick={handleUpload}
                                disabled={uploading}
                                className={clsx(
                                    uploading && "animate-pulse",
                                    "!bg-emerald-600 hover:!bg-emerald-500 !border-emerald-500/30"
                                )}
                            >
                                {uploading ? 'Processando...' : 'Carregar Planilha'}
                            </Button>
                        ) : (
                            <Button
                                icon={Upload}
                                variant="primary"
                                onClick={() => document.getElementById('historical-upload').click()}
                            >
                                Subir Planilha
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {uploadStatus && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={clsx(
                        "p-4 rounded-2xl border-2 flex items-center justify-between gap-4 backdrop-blur-md",
                        uploadStatus.type === 'success' ? "bg-accent-emerald/10 border-accent-emerald/20 text-accent-emerald" :
                            uploadStatus.type === 'error' ? "bg-accent-rose/10 border-accent-rose/20 text-accent-rose" :
                                "bg-accent-blue/10 border-accent-blue/30 text-accent-blue"
                    )}
                >
                    <div className="flex items-center gap-3">
                        {uploadStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                            uploadStatus.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                                <Loader2 className="w-5 h-5 animate-spin" />}
                        <span className="text-sm font-semibold tracking-wide">{uploadStatus.message}</span>
                    </div>
                    {uploadStatus.type !== 'info' && (
                        <button onClick={() => setUploadStatus(null)} className="hover:opacity-70 transition-opacity">
                            <Hash className="w-4 h-4 rotate-45" />
                        </button>
                    )}
                </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="md:col-span-1 p-6 space-y-8 bg-bg-secondary/40 border-border-subtle/30 backdrop-blur-sm">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-gray-300">
                                <Filter className="w-4 h-4 text-accent-blue" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">Filtros Avançados</span>
                            </div>
                            {(selectedSemester || selectedCourse || selectedSubject) && (
                                <button
                                    onClick={() => { setSelectedSemester(''); setSelectedCourse(''); setSelectedSubject(''); }}
                                    className="text-[10px] text-accent-blue hover:text-accent-blue-light font-bold transition-colors uppercase tracking-widest"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1">Semestre Letivo</label>
                                <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}
                                    className="w-full bg-bg-primary/50 border border-border-subtle/50 rounded-xl px-4 py-3 text-sm text-gray-100 font-semibold focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-all cursor-pointer hover:bg-bg-primary/80">
                                    <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Todos os Semestres</option>
                                    {filters.semesters.map(s => (<option key={s} value={s} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>{s}</option>))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1">Curso de Graduação</label>
                                <select value={selectedCourse} onChange={(e) => setSelectedCourse(e.target.value)}
                                    className="w-full bg-bg-primary/50 border border-border-subtle/50 rounded-xl px-4 py-3 text-sm text-gray-100 font-semibold focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-all cursor-pointer hover:bg-bg-primary/80">
                                    <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Todos os Cursos</option>
                                    {filters.courses.map(c => (<option key={c} value={c} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>{c}</option>))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-1">Matéria / Disciplina</label>
                                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}
                                    className="w-full bg-bg-primary/50 border border-border-subtle/50 rounded-xl px-4 py-3 text-sm text-gray-100 font-semibold focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/20 transition-all cursor-pointer hover:bg-bg-primary/80">
                                    <option value="" style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>Todas as Matérias</option>
                                    {filters.subjects?.map(s => (<option key={s} value={s} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>{s}</option>))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="pt-6 border-t border-border-subtle/20">
                        <div className="flex items-center gap-2 text-accent-blue/70 mb-3">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Insights IA</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                            Nossa IA analisa automaticamente dados históricos para gerar padrões e predições mais assertivas.
                        </p>
                    </div>
                </Card>

                <Card className="md:col-span-3 p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-white/[0.02] border-b border-border-subtle">
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Aluno</th>
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Curso / Semestre</th>
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Notas</th>
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-wider font-semibold text-gray-500">Frequência</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="border-b border-border-subtle/50">
                                            <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-40 animate-pulse" /></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-32 animate-pulse" /></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-24 animate-pulse" /></td>
                                            <td className="px-6 py-4"><div className="h-4 bg-white/5 rounded w-16 animate-pulse" /></td>
                                        </tr>
                                    ))
                                ) : records.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-4 rounded-2xl bg-white/[0.03] text-gray-600">
                                                    <FileSpreadsheet className="w-10 h-10" />
                                                </div>
                                                <div>
                                                    <p className="text-gray-400 font-medium">Nenhum dado histórico encontrado</p>
                                                    <p className="text-xs text-gray-600 mt-1">Suba uma planilha para começar a análise de dados antigos</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((record, index) => (
                                        <motion.tr
                                            key={record.id}
                                            className="border-b border-border-subtle/30 hover:bg-white/[0.02] transition-all group cursor-default"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.015 }}
                                        >
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent-blue/10 to-transparent border border-white/5 flex items-center justify-center text-accent-blue shadow-lg group-hover:scale-110 transition-transform">
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-gray-100 text-[13px] tracking-wide group-hover:text-accent-blue transition-colors">
                                                            {record.student_name}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">
                                                            ID: {record.id.toString().padStart(6, '0')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[9px] py-0 px-2 border-accent-blue/30 text-accent-blue-light font-black uppercase tracking-tighter">
                                                            {record.course_name}
                                                        </Badge>
                                                        <span className="text-[10px] text-gray-600 font-bold">P{record.period}</span>
                                                    </div>
                                                    <span className="text-white text-xs font-black uppercase tracking-tight leading-none group-hover:text-accent-blue-light transition-colors">
                                                        {record.subject || 'Carga Básica'}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1 opacity-70">
                                                        <Calendar className="w-2.5 h-2.5" />
                                                        Semestre {record.semester}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    {Object.entries(record.grades || {}).map(([key, val]) => {
                                                        const isSituation = key.toUpperCase() === 'SITUACAO_HIST';
                                                        const label = isSituation ? 'SITUAÇÃO' : key;
                                                        const isApproved = val >= 6 || (isSituation && val?.toString().toLowerCase().includes('aprovado'));
                                                        const isDispensed = isSituation && val?.toString().toLowerCase().includes('dispensado');
                                                        return (
                                                            <div key={key} className="relative group/grade">
                                                                <div className={clsx(
                                                                    "flex flex-col items-center justify-center min-w-[3.5rem] h-11 px-2 rounded-xl border-2 transition-all",
                                                                    isDispensed ? "bg-bg-primary/40 border-border-subtle/50 text-gray-400" :
                                                                        isApproved ? "bg-accent-emerald/5 border-accent-emerald/10 text-accent-emerald" :
                                                                            "bg-accent-rose/5 border-accent-rose/10 text-accent-rose"
                                                                )}>
                                                                    <span className="text-[8px] font-black uppercase opacity-60 mb-0.5">{label}</span>
                                                                    <span className={clsx("font-black tracking-tight", isSituation ? "text-[10px] leading-tight text-center" : "text-xs")}>{val}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {record.attendance !== null ? (
                                                    <div className="flex flex-col gap-2 w-24">
                                                        <span className={clsx("text-[10px] font-black tracking-wide", record.attendance >= 75 ? "text-accent-emerald" : "text-accent-rose")}>
                                                            {record.attendance}%
                                                        </span>
                                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden p-[1px]">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${record.attendance}%` }}
                                                                className={clsx("h-full rounded-full", record.attendance >= 75 ? "bg-accent-emerald/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-accent-rose/60 shadow-[0_0_8px_rgba(244,63,94,0.3)]")}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-white/5 text-gray-500 border-none text-[9px]">S/ Dados</Badge>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* ═══ PAGINATION CONTROLS ═══ */}
                {totalCount > 0 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                        <span className="text-xs text-gray-500">
                            {totalCount.toLocaleString()} registros • Página {currentPage} de {totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage <= 1}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                ← Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage >= totalPages}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                Próxima →
                            </button>
                        </div>
                    </div>
                )}
            </div>            {/* ═══ UPLOAD CHAT PANEL (opens automatically when file is selected) ═══ */}
            <AnimatePresence>
                {showUploadChat && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setShowUploadChat(false); setPendingFile(null); }}
                        />
                        <motion.div
                            className="fixed right-0 top-0 bottom-4 w-full max-w-lg z-[91] flex flex-col"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        >
                            <div className="h-full flex flex-col bg-[#0f1117] border-l border-white/10 shadow-2xl">
                                {/* Header */}
                                <div className="p-5 border-b border-white/10 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center">
                                                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white">Nova Planilha</h3>
                                                <p className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[240px]">
                                                    📎 {pendingFile?.name || 'Arquivo selecionado'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setShowUploadChat(false); setPendingFile(null); }}
                                            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                                    {uploadChatMessages.map((msg, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={clsx("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                    <Bot className="w-4 h-4 text-emerald-400" />
                                                </div>
                                            )}
                                            <div className={clsx(
                                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                                msg.role === 'user'
                                                    ? "bg-emerald-500/20 text-gray-100 rounded-tr-sm"
                                                    : "bg-white/[0.04] text-gray-300 rounded-tl-sm border border-white/5"
                                            )}>
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {uploadChatLoading && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center flex-shrink-0">
                                                <Bot className="w-4 h-4 text-emerald-400" />
                                            </div>
                                            <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-3 border border-white/5">
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Analisando...
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={uploadChatEndRef} />
                                </div>

                                {/* Upload action bar */}
                                {pendingFile && !uploading && (
                                    <div className="px-4 pb-2">
                                        <button
                                            onClick={handleUpload}
                                            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                                        >
                                            <FileCheck className="w-4 h-4" />
                                            Carregar Planilha
                                        </button>
                                    </div>
                                )}

                                {/* Input */}
                                <div className="px-4 pb-6 pt-4 border-t border-white/10 bg-white/[0.01]">
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={uploadChatInputRef}
                                            type="text"
                                            value={uploadChatInput}
                                            onChange={(e) => setUploadChatInput(e.target.value)}
                                            onKeyDown={handleUploadChatKeyDown}
                                            placeholder="Dê recomendações sobre a planilha..."
                                            disabled={uploadChatLoading}
                                            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-all disabled:opacity-40"
                                        />
                                        <button
                                            onClick={sendUploadChatMessage}
                                            disabled={!uploadChatInput.trim() || uploadChatLoading}
                                            className={clsx(
                                                "p-3 rounded-xl transition-all",
                                                uploadChatInput.trim() && !uploadChatLoading
                                                    ? "bg-emerald-500 text-white hover:bg-emerald-500/80 shadow-lg shadow-emerald-500/20"
                                                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                                            )}
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ═══ GENERAL CHAT IA PANEL (for existing data) ═══ */}
            <AnimatePresence>
                {showChat && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowChat(false)}
                        />
                        <motion.div
                            className="fixed right-0 top-0 bottom-4 w-full max-w-lg z-[91] flex flex-col"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        >
                            <div className="h-full flex flex-col bg-[#0f1117] border-l border-white/10 shadow-2xl">
                                {/* Header */}
                                <div className="p-5 border-b border-white/10 bg-gradient-to-r from-accent-blue/5 to-accent-purple/5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue/30 to-accent-purple/30 flex items-center justify-center">
                                                <Sparkles className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white">Chat IA — Dados Históricos</h3>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    🔧 Assistente para gerenciar planilhas já carregadas
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowChat(false)}
                                            className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                                    {chatMessages.map((msg, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={clsx("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                    <Bot className="w-4 h-4 text-accent-blue" />
                                                </div>
                                            )}
                                            <div className={clsx(
                                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                                msg.role === 'user'
                                                    ? "bg-accent-blue/20 text-gray-100 rounded-tr-sm"
                                                    : "bg-white/[0.04] text-gray-300 rounded-tl-sm border border-white/5"
                                            )}>
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {chatLoading && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center flex-shrink-0">
                                                <Bot className="w-4 h-4 text-accent-blue" />
                                            </div>
                                            <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-3 border border-white/5">
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Processando...
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input */}
                                <div className="px-4 pb-6 pt-4 border-t border-white/10 bg-white/[0.01]">
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={chatInputRef}
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={handleChatKeyDown}
                                            placeholder="Pergunte ou peça alterações nos dados..."
                                            disabled={chatLoading}
                                            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-blue/40 focus:ring-1 focus:ring-accent-blue/20 transition-all disabled:opacity-40"
                                        />
                                        <button
                                            onClick={sendChatMessage}
                                            disabled={!chatInput.trim() || chatLoading}
                                            className={clsx(
                                                "p-3 rounded-xl transition-all",
                                                chatInput.trim() && !chatLoading
                                                    ? "bg-accent-blue text-white hover:bg-accent-blue/80 shadow-lg shadow-accent-blue/20"
                                                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                                            )}
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ═══ INSIGHTS PANEL ═══ */}
            <AnimatePresence>
                {showInsights && (
                    <>
                        <motion.div
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowInsights(false)}
                        />
                        <motion.div
                            className="fixed right-0 top-0 bottom-4 w-full max-w-lg z-[91] flex flex-col"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        >
                            <div className="h-full flex flex-col bg-[#0f1117] border-l border-white/10 shadow-2xl">
                                <div className="p-5 border-b border-white/10 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
                                                <Lightbulb className="w-5 h-5 text-amber-400" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-white">Insights Históricos</h3>
                                                <p className="text-[10px] text-gray-400 mt-0.5">🔍 Análise de padrões em dados de semestres passados</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowInsights(false)} className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                                    {insightsMessages.map((msg, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={clsx("flex gap-3", msg.role === 'user' ? "justify-end" : "justify-start")}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                                                    <Lightbulb className="w-4 h-4 text-amber-400" />
                                                </div>
                                            )}
                                            <div className={clsx(
                                                "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                                                msg.role === 'user' ? "bg-amber-500/20 text-gray-100 rounded-tr-sm" : "bg-white/[0.04] text-gray-300 rounded-tl-sm border border-white/5"
                                            )}>
                                                <div className="whitespace-pre-wrap">{msg.content}</div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {insightsLoading && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0">
                                                <Lightbulb className="w-4 h-4 text-amber-400" />
                                            </div>
                                            <div className="bg-white/[0.04] rounded-2xl rounded-tl-sm px-4 py-3 border border-white/5">
                                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Gerando insights...
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={insightsEndRef} />
                                </div>

                                {insightsMessages.length <= 2 && !insightsLoading && (
                                    <div className="px-4 pb-2">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">Sugestões</p>
                                        <div className="flex flex-wrap gap-2">
                                            {['Quais disciplinas têm mais reprovação?', 'Analise tendências por semestre', 'Sugira tratamento dos dados'].map((s, i) => (
                                                <button key={i} onClick={() => {
                                                    setInsightsMessages(prev => [...prev, { role: 'user', content: s }]);
                                                    sendInsightsMessage(s);
                                                }} className="px-3 py-1.5 text-xs bg-amber-500/10 text-amber-300 rounded-lg hover:bg-amber-500/20 border border-amber-500/20 transition-all">
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="px-4 pb-6 pt-4 border-t border-white/10 bg-white/[0.01]">
                                    <div className="flex items-center gap-2">
                                        <input
                                            ref={insightsInputRef}
                                            type="text"
                                            value={insightsInput}
                                            onChange={(e) => setInsightsInput(e.target.value)}
                                            onKeyDown={handleInsightsKeyDown}
                                            placeholder="Pergunte sobre padrões, tendências..."
                                            disabled={insightsLoading}
                                            className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all disabled:opacity-40"
                                        />
                                        <button
                                            onClick={() => sendInsightsMessage()}
                                            disabled={!insightsInput.trim() || insightsLoading}
                                            className={clsx(
                                                "p-3 rounded-xl transition-all",
                                                insightsInput.trim() && !insightsLoading
                                                    ? "bg-amber-500 text-white hover:bg-amber-500/80 shadow-lg shadow-amber-500/20"
                                                    : "bg-white/5 text-gray-600 cursor-not-allowed"
                                            )}
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
