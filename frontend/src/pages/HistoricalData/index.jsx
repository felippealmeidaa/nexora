import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
    AlertCircle,
    BarChart3,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    FileSpreadsheet,
    Filter,
    GraduationCap,
    Lightbulb,
    Loader2,
    Search,
    Send,
    Upload,
    Users,
    Trash2,
    MessageSquare,
    ArrowLeft,
    Calendar,
    Sparkles,
    Copy,
    Check,
    X,
    Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    AreaChart,
    Area,
    Cell,
    ReferenceLine,
} from 'recharts';


import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { buildRolePath } from '@/lib/app-shell';
import { StudentDetailModal } from '@/components/StudentDetailModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCard } from '@/components/ui/MetricCard';
import { PageHeader } from '@/components/ui/PageHeader';

function buildAnalysisLink(basePath, analysis, params = {}) {
    const query = new URLSearchParams({ analysis });
    Object.entries(params).forEach(([key, value]) => {
        if (value) query.set(key, String(value));
    });
    return `${basePath}?${query.toString()}`;
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        if (payload[0]?.payload?.isSeparator) return null;

        const isMediaFinal = label === 'Média Final ✨' || label === 'Média Final';
        const mediaFinalVal = isMediaFinal
            ? payload.find(p => p.dataKey === 'notaProjetada')?.value
            : null;
        const mediaFinalStatus = mediaFinalVal != null
            ? (mediaFinalVal >= 6.0
                ? { label: 'Tendência: Aprovação ✅', color: '#22c55e' }
                : { label: 'Tendência: Risco de Reprovação ⚠️', color: '#ef4444' })
            : null;

        return (
            <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-card backdrop-blur-md">
                <p className="text-xs font-semibold text-text-primary mb-1.5">{label}</p>
                {isMediaFinal && mediaFinalStatus && (
                    <p className="text-[11px] font-bold mb-1.5" style={{ color: mediaFinalStatus.color }}>
                        {mediaFinalStatus.label}
                    </p>
                )}
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


export function HistoricalData({ defaultTab = 'history' }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Estados das Abas
    const [activeTab, setActiveTab] = useState(defaultTab);
    const [correctData, setCorrectData] = useState(false); // Ativar limpeza e correção inteligente por IA
    const [analysisTab, setAnalysisTab] = useState('overview'); // 'overview' ou 'students'
    
    // Listagem de planilhas e Resumo
    const [spreadsheets, setSpreadsheets] = useState([]);
    const [globalSummary, setGlobalSummary] = useState({
        total_spreadsheets: 0,
        total_records: 0,
        avg_grade: 0.0,
        avg_attendance: 0.0,
    });
    
    // Planilha selecionada e sua Analise Específica
    const [selectedSpreadsheet, setSelectedSpreadsheet] = useState(null);
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [records, setRecords] = useState([]);
    
    // Filtros e UI
    const [filters, setFilters] = useState({ semesters: [], courses: [], subjects: [] });
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [loading, setLoading] = useState(true);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    
    // Upload de arquivos
    const [uploading, setUploading] = useState(false);
    const [pendingFile, setPendingFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Chat de IA da Planilha
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const updateFileInputRef = useRef(null);

    // Relatório de Analise com IA
    const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
    const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
    const [showAiAnalysisModal, setShowAiAnalysisModal] = useState(false);
    const [copiedReport, setCopiedReport] = useState(false);

    // Insights Locais da Planilha (Quadro Inferior Esquerdo)
    const [sheetIaInsights, setSheetIaInsights] = useState(null);
    const [sheetIaInsightsLoading, setSheetIaInsightsLoading] = useState(false);

    // Modal de aluno e busca
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null); // null = Adicionar, {...record} = Editar
    const [addEditLoading, setAddEditLoading] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAttentionOnly, setShowAttentionOnly] = useState(false);

    const analysisRoute = buildRolePath(user?.role, 'analysis-center');

    // Inicialização
    useEffect(() => {
        setActiveTab(defaultTab);
    }, [defaultTab]);

    useEffect(() => {
        fetchSpreadsheets();
        fetchFilters();
    }, []);

    // Auto-seleção inteligente pós-upload
    useEffect(() => {
        if (location.state?.autoSelectSpreadsheetId && spreadsheets.length > 0) {
            const targetSheet = spreadsheets.find(s => s.id === location.state.autoSelectSpreadsheetId);
            if (targetSheet) {
                handleSelectSpreadsheet(targetSheet);
            }
            // Limpa o state para não re-selecionar ao recarregar a página
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, spreadsheets]);

    // Scroll do chat de IA
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, chatLoading]);

    // Buscar lista de planilhas
    async function fetchSpreadsheets() {
        setLoading(true);
        try {
            const response = await api.get('/historical-data/spreadsheets');
            const list = response.data.spreadsheets || [];
            setSpreadsheets(list);
            setGlobalSummary(response.data.global_summary || {
                total_spreadsheets: 0,
                total_records: 0,
                avg_grade: 0.0,
                avg_attendance: 0.0,
            });
            return list;
        } catch (error) {
            console.error('Erro ao buscar planilhas', error);
            return [];
        } finally {
            setLoading(false);
        }
    }

    // Buscar filtros estruturais
    async function fetchFilters() {
        try {
            const response = await api.get('/historical-data/filters');
            setFilters(response.data || { semesters: [], courses: [], subjects: [] });
        } catch (error) {
            console.error('Erro ao buscar filtros', error);
        }
    }

    // Abrir planilha específica
    async function handleSelectSpreadsheet(spreadsheet) {
        setAnalysisLoading(true);
        setSelectedSpreadsheet(spreadsheet);
        setSheetIaInsights(null);
        setSheetIaInsightsLoading(false);
        setAnalysisTab('overview');
        setChatMessages([
            {
                role: 'system',
                content: `Olá! Sou a IA assistente da NEXORA. Carreguei os dados da planilha **${spreadsheet.filename}** (${spreadsheet.records_count} alunos). O que gostaria de analisar ou esclarecer sobre este semestre?`
            }
        ]);
        setActiveTab('history');

        try {
            const response = await api.get(`/historical-data/spreadsheets/${spreadsheet.id}/analysis`);
            setSelectedWorkspace(response.data.workspace);
            
            // Buscar os registros filtrados para a listagem
            const recordsRes = await api.get('/historical-data', {
                params: { page: 1, page_size: 150, spreadsheet_id: spreadsheet.id }
            });
            setRecords(recordsRes.data?.records || []);
        } catch (error) {
            console.error('Erro ao carregar dados da planilha', error);
        } finally {
            setAnalysisLoading(false);
        }
    }

    // Deletar planilha específica
    async function handleDeleteSpreadsheet(spreadsheetId, event) {
        event.stopPropagation();
        if (!confirm('Deseja realmente remover esta planilha e todos os seus registros de alunos correspondentes? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            await api.delete(`/historical-data/spreadsheets/${spreadsheetId}`);
            if (selectedSpreadsheet?.id === spreadsheetId) {
                setSelectedSpreadsheet(null);
                setSelectedWorkspace(null);
                setRecords([]);
                setActiveTab('history');
            }
            await fetchSpreadsheets();
        } catch (error) {
            console.error('Erro ao deletar planilha', error);
            alert('Não foi possível remover a planilha selecionada.');
        }
    }

    // Abrir modal de criação
    function handleOpenAddModal() {
        setEditingRecord(null);
        setIsAddEditModalOpen(true);
    }

    // Abrir modal de edição
    function handleOpenEditModal(record) {
        setEditingRecord(record);
        setIsAddEditModalOpen(true);
    }

    // Excluir registro acadêmico
    async function handleDeleteStudentRecord(recordId) {
        if (!confirm('Deseja realmente remover este registro de aluno? Esta ação atualizará as médias gerais da planilha e não pode ser desfeita.')) {
            return;
        }

        try {
            await api.delete(`/historical-data/records/${recordId}`);
            
            // Recarregar os registros locais
            if (selectedSpreadsheet) {
                const recordsRes = await api.get('/historical-data', {
                    params: { page: 1, page_size: 150, spreadsheet_id: selectedSpreadsheet.id }
                });
                setRecords(recordsRes.data?.records || []);

                // Recarregar as estatísticas da planilha
                const sheetsRes = await api.get('/historical-data/spreadsheets');
                const updatedSheet = (sheetsRes.data || []).find(s => s.id === selectedSpreadsheet.id);
                if (updatedSheet) {
                    setSelectedSpreadsheet(updatedSheet);
                }
            }
        } catch (error) {
            console.error('Erro ao deletar registro de aluno', error);
            alert('Não foi possível remover o registro de aluno selecionado.');
        }
    }

    // Tratar seleção de arquivo
    function handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setUploadStatus(null);
        event.target.value = '';
    }

    // Manipuladores de Drag & Drop para Upload de Arquivos
    function handleDragOver(e) {
        e.preventDefault();
        setIsDragging(true);
    }

    // Remover feedback visual ao sair
    function handleDragLeave() {
        setIsDragging(false);
    }

    // Processar arquivo solto na Dropzone
    function handleDrop(e) {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const allowedExtensions = ['.csv', '.xlsx', '.xls', '.txt', '.pdf'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            if (allowedExtensions.includes(fileExtension)) {
                setPendingFile(file);
                setUploadStatus(null);
            } else {
                alert('Formato de arquivo não suportado. Por favor, envie CSV, XLSX, XLS, TXT ou PDF.');
            }
        }
    }

    // Subir planilha
    async function handleUpload() {
        if (!pendingFile || uploading) return;

        setUploading(true);
        setUploadStatus({ type: 'info', message: 'Tratando dados, estruturando colunas e consolidando no banco local...' });

        try {
            const formData = new FormData();
            formData.append('file', pendingFile);
            formData.append('correct_data', String(correctData));

            const response = await api.post('/historical-data/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 600000, // 10 minutos para uploads gigantescos
            });

            setUploadStatus({
                type: 'success',
                message: `${response.data.records_count} registros processados e vinculados à planilha com sucesso.`,
                payload: response.data,
            });
            setPendingFile(null);
            
            const latestSpreadsheets = await fetchSpreadsheets();
            await fetchFilters();

            // Redireciona inteligentemente para a página física do histórico com a planilha selecionada no state
            const createdSpreadsheetId = response.data.spreadsheet_id;
            navigate(buildRolePath(user?.role, 'historical-data'), {
                state: { autoSelectSpreadsheetId: createdSpreadsheetId }
            });
        } catch (error) {
            setUploadStatus({
                type: 'error',
                message: error.response?.data?.detail || 'Não foi possível processar o arquivo selecionado.',
            });
        } finally {
            setUploading(false);
        }
    }

    // Atualizar planilha por cima com um novo arquivo
    async function handleUpdateSpreadsheetFile(e) {
        const file = e.target.files?.[0];
        if (!file || !selectedSpreadsheet) return;

        const allowedExtensions = ['.csv', '.xlsx', '.xls', '.txt', '.pdf'];
        const nameLower = file.name.toLowerCase();
        const isValid = allowedExtensions.some(ext => nameLower.endsWith(ext));

        if (!isValid) {
            alert('Formato de arquivo não suportado. Por favor, envie CSV, XLSX, XLS, TXT ou PDF.');
            return;
        }

        const confirmSubstitute = window.confirm(
            `Deseja realmente carregar os dados do arquivo "${file.name}" por cima de "${selectedSpreadsheet.filename}"?\n\nIsso apagará permanentemente todos os registros de alunos antigos desta planilha e os substituirá pelos dados do novo arquivo.`
        );

        if (!confirmSubstitute) {
            e.target.value = ''; // Limpar o input
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('correct_data', String(correctData));
            formData.append('target_spreadsheet_id', String(selectedSpreadsheet.id));

            const response = await api.post('/historical-data/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 600000, // 10 minutos
            });

            alert(`Planilha atualizada com sucesso! ${response.data.records_count} novos registros processados.`);
            
            // Recarregar os dados
            const sheets = await fetchSpreadsheets();
            await fetchFilters();
            
            // Re-selecionar a mesma planilha para atualizar os dados na tela
            const updatedSheet = sheets.find(s => s.id === selectedSpreadsheet.id);
            if (updatedSheet) {
                setSelectedSpreadsheet(updatedSheet);
                // Buscar registros atualizados na aba de turmas
                await fetchRecords(updatedSheet.id);
            }
        } catch (error) {
            alert(error.response?.data?.detail || 'Não foi possível atualizar a planilha com o arquivo selecionado.');
        } finally {
            setUploading(false);
            e.target.value = ''; // Limpar o input
        }
    }

    // Enviar mensagem no chat da planilha
    async function handleSendSheetChatMessage(messageText) {
        const text = messageText || chatInput.trim();
        if (!text || chatLoading || !selectedSpreadsheet) return;

        setChatMessages(prev => [...prev, { role: 'user', content: text }]);
        if (!messageText) setChatInput('');
        setChatLoading(true);

        try {
            const response = await api.post(`/historical-data/spreadsheets/${selectedSpreadsheet.id}/chat`, {
                message: text
            });
            setChatMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
        } catch (error) {
            console.error('Erro no chat da planilha', error);
            setChatMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao contatar a inteligência artificial para este documento.' }]);
        } finally {
            setChatLoading(false);
        }
    }

    // Disparar analise profunda de IA da planilha
    async function handleTriggerAiAnalysis(spreadsheetToAnalyze) {
        const targetSheet = spreadsheetToAnalyze || selectedSpreadsheet;
        if (!targetSheet) return;

        setAiAnalysisLoading(true);
        setShowAiAnalysisModal(true);
        setAiAnalysisResult(null);
        try {
            const response = await api.post(`/historical-data/spreadsheets/${targetSheet.id}/ai-analysis`);
            if (response.data && response.data.success) {
                setAiAnalysisResult(response.data);
            } else {
                setAiAnalysisResult({
                    analysis_report: 'Desculpe, a IA retornou uma resposta incompleta. Tente novamente mais tarde.'
                });
            }
        } catch (error) {
            console.error('Erro ao gerar analise profunda da IA', error);
            setAiAnalysisResult({
                analysis_report: 'Ocorreu um erro técnico ao processar esta planilha com o serviço do Google Gemini. Verifique se a chave GEMINI_API_KEY está configurada no .env na raiz do projeto.'
            });
        } finally {
            setAiAnalysisLoading(false);
        }
    }

    // Gerar insights pedagógicos táticos locais para a pior turma do histórico
    async function handleGenerateSheetInsights() {
        if (!selectedSpreadsheet) return;

        setSheetIaInsightsLoading(true);
        setSheetIaInsights(null);

        try {
            const response = await api.post(`/historical-data/spreadsheets/${selectedSpreadsheet.id}/ai-insights`);
            if (response.data && response.data.insights) {
                setSheetIaInsights(response.data.insights);
            } else {
                setSheetIaInsights('Desculpe, ocorreu uma falha ao gerar as recomendações pedagógicas locais. Tente novamente.');
            }
        } catch (error) {
            console.error('Erro ao gerar insights pedagógicos locais da planilha', error);
            setSheetIaInsights('Ocorreu um erro técnico ao processar as dicas de intervenção com a IA.');
        } finally {
            setSheetIaInsightsLoading(false);
        }
    }

    // Exportar plano de intervenção pedagógica gerado pela IA em Markdown
    const handleExportMarkdownInsights = () => {
        if (!sheetIaInsights) return;
        const blob = new Blob([sheetIaInsights], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `Plano_de_Intervencao_NEXORA_${dateStr}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Sugestões de perguntas rápidas focadas em monitoramento preventivo
    const quickQuestions = [
        "Quais alunos estão sob Risco Crítico de reprovação e como posso intervir?",
        "Qual é a taxa de reprovação final projetada e o gargalo de comportamento?",
        "Destaque a disciplina com maior risco e dê sugestões pedagógicas.",
        "Gere rascunhos de mensagens coletivas (WhatsApp/E-mail) para alunos sob risco."
    ];

    // Cálculo síncrono das estatísticas de risco preventivo da planilha selecionada
    const preventiveStats = useMemo(() => {
        if (!records || records.length === 0) return null;

        const total = records.length;
        let aprovados = 0;
        let riscoNota = 0;
        let riscoFalta = 0;
        let riscoAmbos = 0;
        let presencaBaixaCount = 0;
        let presencaBaixaNotaBaixaCount = 0;

        const hasAttendanceData = records.some(r => r.attendance !== null && r.attendance !== undefined);

        records.forEach(r => {
            const grade = r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : 7.0;
            const att = r.attendance !== null && r.attendance !== undefined ? parseFloat(r.attendance) : null;

            const isNotaVermelha = grade < 6.0;
            const isPresencaBaixa = hasAttendanceData && att !== null && att < 75.0;

            if (!isNotaVermelha && !isPresencaBaixa) {
                aprovados++;
            } else if (isNotaVermelha && !isPresencaBaixa) {
                riscoNota++;
            } else if (!isNotaVermelha && isPresencaBaixa) {
                riscoFalta++;
            } else {
                riscoAmbos++;
            }

            if (isPresencaBaixa) {
                presencaBaixaCount++;
                if (isNotaVermelha) {
                    presencaBaixaNotaBaixaCount++;
                }
            }
        });

        const alunosEmRisco = riscoNota + riscoFalta + riscoAmbos;
        const reprovacaoProjetadaPct = total > 0 ? ((alunosEmRisco / total) * 100).toFixed(1) : '0.0';
        const correlacaoFaltaNotaPct = presencaBaixaCount > 0 ? ((presencaBaixaNotaBaixaCount / presencaBaixaCount) * 100).toFixed(1) : '0.0';

        return {
            total,
            aprovados,
            riscoNota,
            riscoFalta,
            riscoAmbos,
            reprovacaoProjetadaPct,
            correlacaoFaltaNotaPct,
            hasAttendanceData
        };
    }, [records]);

    // Cálculo da evolução de médias da turma por avaliação
    const evolutionChartData = useMemo(() => {
        if (!records || records.length === 0) return [];

        // Determina o slot canônico (1=P1/VA1, 2=P2/VA2, 3=P3/VA3) e se é projeção
        const getEvalSlot = (key) => {
            const kLower = key.toLowerCase();
            const isProj = /projetada|✨/i.test(kLower);
            
            // Remove marcações de projeção para normalizar a chave e determinar o slot
            const cleanKey = key.toUpperCase()
                .replace(/\s*\(PROJETADA\)\s*✨?/g, '')
                .replace(/✨/g, '')
                .trim();

            if (/^(VA1|P1|AV1|N1|NOTA1)$/.test(cleanKey)) {
                return { slot: 1, label: 'P1 / VA1', isProj };
            }
            if (/^(VA2|P2|AV2|N2|NOTA2)$/.test(cleanKey)) {
                return { slot: 2, label: 'P2 / VA2', isProj };
            }
            if (/^(VA3|P3|AV3|N3|NOTA3|FINAL)$/.test(cleanKey)) {
                return { slot: 3, label: 'P3 / VA3', isProj };
            }
            return null;
        };

        // Acumular por slot — real tem prioridade sobre projeção
        const slotData = {};

        records.forEach(r => {
            const grades = r.grades || {};
            Object.entries(grades).forEach(([key, val]) => {
                if (/situacao|status|resultado/i.test(key)) return;
                const numericVal = parseFloat(String(val).replace(',', '.'));
                if (isNaN(numericVal)) return;

                const info = getEvalSlot(key);
                if (!info) return;

                const { slot, label, isProj } = info;
                if (!slotData[slot]) {
                    slotData[slot] = { label, realSum: 0, realCount: 0, projSum: 0, projCount: 0 };
                }

                if (isProj) {
                    slotData[slot].projSum += numericVal;
                    slotData[slot].projCount += 1;
                } else {
                    slotData[slot].realSum += numericVal;
                    slotData[slot].realCount += 1;
                }
            });
        });

        const slots = Object.keys(slotData).map(Number).sort((a, b) => a - b);
        if (slots.length === 0) return [];

        const chartData = [];
        let lastRealSlot = null;
        let realAvgSum = 0;
        let realAvgCount = 0;

        slots.forEach(slot => {
            const s = slotData[slot];
            const hasReal = s.realCount > 0;
            const hasProj = s.projCount > 0;
            const realAvg = hasReal ? parseFloat((s.realSum / s.realCount).toFixed(2)) : null;
            const projAvg = hasProj ? parseFloat((s.projSum / s.projCount).toFixed(2)) : null;

            let labelName = s.label;
            if (slot === 1) labelName = hasReal ? 'VA1' : 'P1';
            else if (slot === 2) labelName = hasReal ? 'VA2' : 'P2';
            else if (slot === 3) labelName = hasReal ? 'VA3' : 'P3';

            chartData.push({
                name: labelName,
                slot,
                // Nota real tem prioridade: se P2 ja foi lancada, nao mostrar como projetada
                notaReal: realAvg,
                notaProjetada: hasReal ? null : projAvg,
            });

            if (hasReal) {
                lastRealSlot = slot;
                realAvgSum += realAvg;
                realAvgCount += 1;
            }
        });

        // --- Ponto de Média Final Projetada ---
        // Sempre adiciona um ponto de destino da predição ao final do gráfico.
        // Se todas as notas estão preenchidas (ex: planilha completa), calcula
        // a média final real e exibe como projeção para manter a linha pontilhada visível.
        if (lastRealSlot !== null && realAvgCount > 0) {
            // Média ponderada das notas reais disponíveis
            const mediaFinal = parseFloat((realAvgSum / realAvgCount).toFixed(2));

            // Pega o último ponto real e conecta a linha de projeção
            const lastRealPt = chartData.find(pt => pt.slot === lastRealSlot);
            if (lastRealPt) {
                lastRealPt.notaProjetada = lastRealPt.notaReal;
            }

            // Adiciona o ponto final de Média Final como destino da linha de projeção
            chartData.push({
                name: 'Média Final',
                slot: 99,
                notaReal: null,
                notaProjetada: mediaFinal,
            });
        } else {
            // Fallback: conectar linha de projeção sem o ponto final (caso extremo)
            const hasAnyProjection = chartData.some(pt => pt.notaProjetada !== null);
            if (hasAnyProjection && lastRealSlot !== null) {
                const lastRealPt = chartData.find(pt => pt.slot === lastRealSlot);
                if (lastRealPt && lastRealPt.notaReal !== null) {
                    lastRealPt.notaProjetada = lastRealPt.notaReal;
                }
            }
        }

        return chartData;
    }, [records]);

    // Identifica o último ponto no tempo que possui dados reais (para traçar a linha divisória)
    const lastRealName = useMemo(() => {
        if (!evolutionChartData || evolutionChartData.length === 0) return null;
        const realPoints = evolutionChartData.filter(pt => pt.notaReal !== null && pt.name !== 'Média Final ✨');
        if (realPoints.length === 0) return null;
        return realPoints[realPoints.length - 1].name;
    }, [evolutionChartData]);


    // Cálculo de distribuição de notas por faixa de rendimento
    const gradesDistribution = useMemo(() => {
        if (!records || records.length === 0) return null;

        let critico = 0;
        let atencao = 0;
        let bom = 0;
        let excelente = 0;
        const total = records.length;

        records.forEach(r => {
            const grade = r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : 7.0;
            if (grade < 4.0) {
                critico++;
            } else if (grade < 6.0) {
                atencao++;
            } else if (grade < 8.0) {
                bom++;
            } else {
                excelente++;
            }
        });

        return {
            critico: { count: critico, pct: total > 0 ? parseFloat(((critico / total) * 100).toFixed(1)) : 0 },
            atencao: { count: atencao, pct: total > 0 ? parseFloat(((atencao / total) * 100).toFixed(1)) : 0 },
            bom: { count: bom, pct: total > 0 ? parseFloat(((bom / total) * 100).toFixed(1)) : 0 },
            excelente: { count: excelente, pct: total > 0 ? parseFloat(((excelente / total) * 100).toFixed(1)) : 0 },
            total
        };
    }, [records]);

    // Agrupamento de disciplinas com médias e taxa de risco (Disciplinas Gargalo)
    const subjectsSummary = useMemo(() => {
        if (!records || records.length === 0) return [];

        const summary = {};
        records.forEach(r => {
            const sub = r.subject || 'Geral';
            if (!summary[sub]) {
                summary[sub] = { name: sub, totalGrades: 0, countGrades: 0, totalStudents: 0, riskStudents: 0 };
            }

            const grade = r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : null;
            const att = r.attendance !== null && r.attendance !== undefined ? parseFloat(r.attendance) : null;

            summary[sub].totalStudents += 1;
            if (grade !== null) {
                summary[sub].totalGrades += grade;
                summary[sub].countGrades += 1;
            }

            const isNotaVermelha = grade !== null && grade < 6.0;
            const isPresencaBaixa = att !== null && att < 75.0;
            if (isNotaVermelha || isPresencaBaixa) {
                summary[sub].riskStudents += 1;
            }
        });

        return Object.values(summary).map(s => ({
            name: s.name,
            avgGrade: s.countGrades > 0 ? parseFloat((s.totalGrades / s.countGrades).toFixed(2)) : 0,
            totalStudents: s.totalStudents,
            riskStudents: s.riskStudents,
            riskPercent: s.totalStudents > 0 ? parseFloat(((s.riskStudents / s.totalStudents) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.riskPercent - a.riskPercent);
    }, [records]);

    const highlightedTopics = selectedWorkspace?.analysis_data?.intervention_window?.slice(0, 3) || [];
    const highRiskClasses = selectedWorkspace?.analysis_data?.high_risk_classes?.slice(0, 3) || [];
    
    // Algoritmo de fallback para identificar e destacar a pior turma caso nenhuma esteja em alto risco
    const allSpreadsheetClasses = selectedWorkspace?.analysis_data?.by_class || [];

    const worstClassByGrade = useMemo(() => {
        if (!allSpreadsheetClasses.length) return null;
        return [...allSpreadsheetClasses].sort((a, b) => (a.avg_grade || 0) - (b.avg_grade || 0))[0];
    }, [allSpreadsheetClasses]);

    const classesForGradeChart = useMemo(() => {
        if (!allSpreadsheetClasses || allSpreadsheetClasses.length === 0) return [];
        const sorted = [...allSpreadsheetClasses].sort((a, b) => (b.avg_grade || 0) - (a.avg_grade || 0));
        
        let best = [];
        let worst = [];
        
        if (sorted.length <= 10) {
            const half = Math.ceil(sorted.length / 2);
            best = sorted.slice(0, half).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(half).map(c => ({ ...c, isWorst: true }));
        } else {
            best = sorted.slice(0, 5).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(-5).map(c => ({ ...c, isWorst: true }));
        }
        
        const separator = {
            id: 'separator-grade',
            label: ' ➔ | ➔ ',
            avg_grade: 0.001,
            isSeparator: true,
            isWorst: false
        };
        
        return [...best, separator, ...worst];
    }, [allSpreadsheetClasses]);

    const classesForAttendanceChart = useMemo(() => {
        if (!allSpreadsheetClasses || allSpreadsheetClasses.length === 0) return [];
        const sorted = [...allSpreadsheetClasses].sort((a, b) => (b.avg_attendance || 0) - (a.avg_attendance || 0));
        
        let best = [];
        let worst = [];
        
        if (sorted.length <= 10) {
            const half = Math.ceil(sorted.length / 2);
            best = sorted.slice(0, half).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(half).map(c => ({ ...c, isWorst: true }));
        } else {
            best = sorted.slice(0, 5).map(c => ({ ...c, isWorst: false }));
            worst = sorted.slice(-5).map(c => ({ ...c, isWorst: true }));
        }
        
        const separator = {
            id: 'separator-attendance',
            label: ' ➔ | ➔ ',
            avg_attendance: 0.001,
            isSeparator: true,
            isWorst: false
        };
        
        return [...best, separator, ...worst];
    }, [allSpreadsheetClasses]);

    const displayedHighRiskClasses = useMemo(() => {
        const hasHighRisk = highRiskClasses.some(c => c.risk_score >= 0.38 || c.critical_students > 0);
        if (hasHighRisk) {
            return highRiskClasses;
        }
        if (worstClassByGrade) {
            return [
                {
                    id: worstClassByGrade.id,
                    label: worstClassByGrade.label,
                    risk_score: worstClassByGrade.risk_score || 0.1,
                    risk_level: 'medium',
                    recommended_focus: `Destaque Acadêmico (Pior Desempenho): Esta turma obteve o menor aproveitamento acadêmico do arquivo (média: ${worstClassByGrade.avg_grade?.toFixed(1) || '--'}). Recomenda-se ações preventivas de reforço.`,
                    is_fallback: true
                }
            ];
        }
        return [];
    }, [highRiskClasses, worstClassByGrade]);

    const displayedHighlightedTopics = useMemo(() => {
        const hasRiskTopics = highlightedTopics.some(t => t.current_risk >= 0.38);
        if (hasRiskTopics) {
            return highlightedTopics.map(item => ({
                id: item.id,
                type: 'Alerta de Risco',
                label: item.student_name,
                signal: `Aluno em zona ${item.zone_label} com risco de ${item.risk_pct}%.`,
                is_fallback: false
            }));
        }
        if (worstClassByGrade) {
            return [
                {
                    id: `fallback-topic-${worstClassByGrade.id}`,
                    type: 'Alerta Preventivo',
                    label: worstClassByGrade.label,
                    signal: `A turma apresenta a menor média geral de notas (${worstClassByGrade.avg_grade?.toFixed(1) || '--'}), exigindo atenção pedagógica dos professores.`,
                    is_fallback: true
                }
            ];
        }
        return [];
    }, [highlightedTopics, worstClassByGrade]);

    const uploadSummary = uploadStatus?.payload?.summary;
    const uploadWarnings = uploadStatus?.payload?.warnings || [];
    const uploadNormalizationSteps = uploadStatus?.payload?.normalization_steps || [];
    const organizedUploadGroups = uploadStatus?.payload?.class_groups?.slice(0, 4) || [];

    const groupedRecords = useMemo(
        () => buildGroupedRecords(records, { searchTerm, showAttentionOnly }),
        [records, searchTerm, showAttentionOnly],
    );

    const filteredRecordsList = useMemo(() => {
        const normalizedSearch = normalizeText(searchTerm || '');
        return records.filter((r) => {
            const matchesSearch = !normalizedSearch || [
                r.student_name,
                r.subject,
                r.course_name,
                r.registration_number,
            ].some((value) => normalizeText(value).includes(normalizedSearch));

            if (!matchesSearch) return false;

            if (showAttentionOnly && !isAttentionStudent(r)) return false;

            return true;
        }).sort((a, b) => String(a.student_name || '').localeCompare(String(b.student_name || '')));
    }, [records, searchTerm, showAttentionOnly]);

    const normalizationSteps = useMemo(() => ([
        'Reconhece colunas fora de ordem e nomes diferentes para semestre, aluno, nota e frequência.',
        'Converte CSV, XLSX, TXT e PDF para uma estrutura única antes da leitura analítica.',
        'Vincula registros diretamente a um documento rastreável na aba de histórico.',
    ]), []);
    const normalizationChecklist = uploadNormalizationSteps.length ? uploadNormalizationSteps : normalizationSteps;

    return (
        <div className="space-y-6">
            {/* ABA 1: SUBIR PLANILHA */}
            {activeTab === 'upload' && (
                <div className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                        {/* Seção de Upload */}
                        <Card variant="hero">
                            <CardHeader
                                title="Tratamento Inteligente de Arquivos"
                                subtitle="Envie planilhas e PDFs de notas ou frequências anteriores. A NEXORA padroniza os arquivos, limpa inconsistências usando IA e estrutura a base de dados automaticamente."
                                icon={Upload}
                            />

                            {/* Input de Arquivos Principal - Sempre Montado para Acesso por Ref e ID */}
                            <input
                                id="central-file-upload"
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".csv,.xlsx,.xls,.txt,.pdf"
                                onChange={handleFileSelect}
                            />

                            <div className="space-y-3">
                                {normalizationChecklist.map((step) => (
                                    <div key={step} className="rounded-[22px] border border-border-subtle bg-white/75 px-4 py-3.5 text-sm leading-6 text-text-secondary">
                                        {step}
                                    </div>
                                ))}
                            </div>

                            {/* Novo Seletor Premium de Modo da IA */}
                            <div className="mt-5 space-y-3">
                                <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary flex items-center gap-1.5">
                                    <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                                    Modo de Operação por IA (NEXORA Copilot)
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Opção A: Apenas Leitura */}
                                    <div
                                        onClick={() => setCorrectData(false)}
                                        className={`cursor-pointer rounded-2xl border p-4 transition-all flex flex-col gap-1.5 ${
                                            !correctData
                                                ? 'border-indigo-500 bg-indigo-50/10 shadow-soft'
                                                : 'border-border-subtle bg-white/60 hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-text-primary">Apenas Leitura e Análise</span>
                                            <Badge variant={!correctData ? "primary" : "neutral"} className="text-[9px]">Padrão</Badge>
                                        </div>
                                        <p className="text-[10.5px] text-text-secondary leading-5">
                                            A IA analisa os dados para gerar insights pedagógicos e alertas, mas mantém as notas e presenças originais intocadas no banco.
                                        </p>
                                    </div>

                                    {/* Opção B: Limpeza e Ajuste por IA */}
                                    <div
                                        onClick={() => setCorrectData(true)}
                                        className={`cursor-pointer rounded-2xl border p-4 transition-all flex flex-col gap-1.5 ${
                                            correctData
                                                ? 'border-indigo-500 bg-indigo-50/10 shadow-soft'
                                                : 'border-border-subtle bg-white/60 hover:bg-white'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-text-primary">Limpeza e Ajuste por IA</span>
                                            <Badge variant={correctData ? "warning" : "neutral"} className="text-[9px]">Ativo</Badge>
                                        </div>
                                        <p className="text-[10.5px] text-text-secondary leading-5">
                                            A IA conserta ativamente acentuação quebrada (ex: "JoÆo" para "João"), normaliza escalas de notas e frequências decimais na base antes de salvar.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {!pendingFile && (
                                <label 
                                    htmlFor="central-file-upload"
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`relative mt-6 flex flex-col items-center justify-center overflow-hidden rounded-[28px] border-2 border-dashed px-6 py-12 text-center transition-all duration-300 cursor-pointer ${
                                        isDragging
                                            ? 'border-indigo-600 bg-indigo-50/40 shadow-soft scale-[1.01] dark:bg-indigo-950/50 dark:border-indigo-500'
                                            : 'border-indigo-200 bg-gradient-to-br from-indigo-50/30 via-white/80 to-indigo-50/10 hover:border-indigo-400 hover:bg-white hover:shadow-md dark:border-border-subtle dark:from-indigo-950/30 dark:via-bg-card/90 dark:to-indigo-950/10 dark:hover:border-indigo-500/30 dark:hover:bg-bg-card-hover'
                                    }`}
                                >
                                    <div className="flex flex-col items-center gap-4">
                                        <div className={`p-4 rounded-full transition-all duration-300 ${
                                            isDragging ? 'bg-indigo-600 text-white animate-bounce' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 group-hover:scale-110'
                                        }`}>
                                            <Upload className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-text-primary">
                                                Arraste sua planilha aqui ou clique para selecionar
                                            </p>
                                            <p className="mt-1.5 text-xs text-text-secondary leading-relaxed max-w-[420px] mx-auto">
                                                Suporta arquivos nos formatos <span className="font-semibold text-indigo-600 dark:text-indigo-400">CSV, XLSX, XLS, TXT e PDF</span>. A IA estruturará os dados e corrigirá inconsistências automaticamente.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant="primary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 animate-pulse">IA Nexora</Badge>
                                            <span className="text-[10px] text-text-tertiary">Normalização inteligente de dados ativa</span>
                                        </div>
                                    </div>
                                </label>
                            )}

                            {pendingFile && (
                                <div className="mt-5 rounded-[24px] border border-accent-blue/20 bg-white/80 p-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-text-primary">{pendingFile.name}</p>
                                            <p className="mt-1 text-sm text-text-secondary">
                                                Pronto para estruturar, associar e analisar.
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="info">{(pendingFile.size / 1024).toFixed(1)} KB</Badge>
                                            <Badge variant="neutral">{pendingFile.name.split('.').pop()?.toUpperCase() || 'ARQ'}</Badge>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-3">
                                        <Button onClick={handleUpload} loading={uploading} icon={Sparkles}>
                                            Confirmar e Analisar com IA
                                        </Button>
                                        <Button 
                                            variant="secondary"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            Trocar
                                        </Button>
                                        <Button variant="secondary" onClick={() => setPendingFile(null)}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card>

                        {/* Resposta do Upload */}
                        <Card>
                            <CardHeader
                                title="Status de Processamento"
                                subtitle="Sinais iniciais e turmas geradas a partir do último envio."
                                icon={CheckCircle2}
                            />

                            {uploadStatus ? (
                                <div className={[
                                    'rounded-[24px] border px-4 py-4 text-sm',
                                    uploadStatus.type === 'success'
                                        ? 'border-success/20 bg-success/5 text-success'
                                        : uploadStatus.type === 'error'
                                            ? 'border-danger/20 bg-danger/5 text-danger'
                                            : 'border-accent-blue/20 bg-accent-blue/5 text-accent-blue',
                                ].join(' ')}>
                                    {uploadStatus.message}
                                </div>
                            ) : (
                                <div className="rounded-[24px] border border-dashed border-border-subtle px-4 py-5 text-sm text-text-secondary">
                                    Aguardando envio para apresentar os primeiros sinais.
                                </div>
                            )}

                            {uploadSummary && (
                                <div className="mt-4 grid gap-3 grid-cols-3">
                                    <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                        <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Alunos</p>
                                        <p className="mt-1 text-lg font-semibold text-text-primary">{uploadSummary.students || 0}</p>
                                    </div>
                                    <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                        <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Nota Média</p>
                                        <p className="mt-1 text-lg font-semibold text-text-primary">
                                            {uploadSummary.avg_grade?.toFixed?.(2) || uploadSummary.avg_grade || '--'}
                                        </p>
                                    </div>
                                    <div className="rounded-2xl bg-bg-secondary/50 p-4">
                                        <p className="text-xs uppercase tracking-[0.14em] text-text-tertiary">Presença Média</p>
                                        <p className="mt-1 text-lg font-semibold text-text-primary">
                                            {uploadSummary.avg_attendance?.toFixed?.(1) || uploadSummary.avg_attendance || '--'}%
                                        </p>
                                    </div>
                                </div>
                            )}

                            {uploadWarnings.length > 0 && (
                                <div className="mt-4 rounded-[24px] border border-warning/20 bg-warning/5 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">Alertas</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {uploadWarnings.map((warning) => (
                                            <Badge key={warning} variant="warning">{warning}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {/* ABA 2: HISTÓRICO DE PLANILHAS E ANALISES INTEGRADAS */}
            {activeTab === 'history' && (
                <div>
                    {!selectedSpreadsheet ? (
                        <div className="space-y-6">
                            {/* KPIs Macro Acumulados */}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <MetricCard
                                    title="Planilhas integradas"
                                    value={loading ? '...' : globalSummary.total_spreadsheets}
                                    helper="Total de documentos históricos salvos"
                                    icon={FileSpreadsheet}
                                    tone="indigo"
                                />
                                <MetricCard
                                    title="Registros consolidados"
                                    value={loading ? '...' : globalSummary.total_records}
                                    helper="Alunos processados no histórico"
                                    icon={Users}
                                    tone="blue"
                                />
                                <MetricCard
                                    title="Média Geral de Notas"
                                    value={loading ? '...' : (globalSummary.avg_grade?.toFixed?.(2) || globalSummary.avg_grade || '--')}
                                    helper="Desempenho acadêmico acumulado"
                                    icon={GraduationCap}
                                    tone="emerald"
                                />
                                <MetricCard
                                    title="Média de Frequência"
                                    value={loading ? '...' : (globalSummary.avg_attendance?.toFixed?.(1) || globalSummary.avg_attendance || '--') + '%'}
                                    helper="Taxa média de presença discente"
                                    icon={CheckCircle2}
                                    tone="amber"
                                />
                            </div>

                            {/* Tabela de Planilhas Subidas */}
                            <Card>
                        <CardHeader
                            title="Planilhas e Históricos Enviados"
                            subtitle="Acompanhe e analise planilhas consolidadas no banco de dados. Utilize a central pedagógica de IA de forma integrada clicando em um arquivo para abrir o painel de análise."
                            icon={FileSpreadsheet}
                        />

                        {loading ? (
                            <div className="flex min-h-[200px] items-center justify-center gap-3 text-text-secondary">
                                <Loader2 className="h-5 w-5 animate-spin text-accent-blue" />
                                Carregando planilhas...
                            </div>
                        ) : spreadsheets.length === 0 ? (
                            <EmptyState
                                icon={Upload}
                                title="Nenhuma planilha cadastrada"
                                description="Realize o upload de sua primeira planilha para começar a usufruir das análises e predições com IA."
                            />
                        ) : (
                            <div className="space-y-8">
                                {/* Seção: Em Andamento */}
                                {spreadsheets.filter(s => !s.is_completed).length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-indigo-600 flex items-center gap-2 px-1">
                                            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 animate-pulse" />
                                            ⚡ Planilhas em Andamento (Previsões por IA Ativas)
                                        </h3>
                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {spreadsheets.filter(s => !s.is_completed).map((sheet) => {
                                                const isPdf = sheet.filename.toLowerCase().endsWith('.pdf');
                                                return (
                                                    <motion.div
                                                        key={sheet.id}
                                                        whileHover={{ y: -4 }}
                                                        onClick={() => handleSelectSpreadsheet(sheet)}
                                                        className="cursor-pointer flex flex-col rounded-[26px] border-2 border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-br from-indigo-50/20 to-white dark:from-indigo-950/10 dark:to-bg-card p-5 shadow-soft hover:bg-white dark:hover:bg-bg-card-hover hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-indigo-100/50 dark:hover:shadow-none transition-all group relative overflow-hidden"
                                                    >
                                                        <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-0.5">
                                                            <span>✨ IA Preditiva</span>
                                                        </div>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/45 dark:text-indigo-400`}>
                                                                <FileSpreadsheet className="h-5 w-5" />
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleDeleteSpreadsheet(sheet.id, e)}
                                                                className="p-2 text-text-tertiary hover:text-danger hover:bg-danger/5 rounded-xl transition mr-8"
                                                                title="Excluir arquivo"
                                                                aria-label="Excluir"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <h4 className="mt-4 text-xs font-bold text-text-primary group-hover:text-indigo-600 transition-colors line-clamp-1">
                                                            {sheet.filename}
                                                        </h4>
                                                        <p className="text-[10px] text-text-secondary mt-1 flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            {new Date(sheet.uploaded_at).toLocaleDateString('pt-BR')}
                                                        </p>
                                                        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                                                            <Badge variant="neutral">{sheet.semester || 'Semestre N/A'}</Badge>
                                                            <Badge variant="neutral" className="line-clamp-1 max-w-[120px]">{sheet.course_name || 'Geral'}</Badge>
                                                            <Badge variant="neutral" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/65">Em Andamento</Badge>
                                                        </div>
                                                        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-[10px] text-text-secondary">
                                                            <div>
                                                                <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Alunos</span>
                                                                <span className="font-semibold text-text-primary mt-0.5 block">{sheet.records_count}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Média Proj.</span>
                                                                <span className="font-semibold text-indigo-600 mt-0.5 block">{sheet.avg_grade ? sheet.avg_grade.toFixed(1) : '--'} ✨</span>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Presença</span>
                                                                <span className="font-semibold text-text-primary mt-0.5 block">{sheet.avg_attendance ? `${sheet.avg_attendance.toFixed(0)}%` : '--'}</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Seção: Concluídas */}
                                <div className="space-y-4">
                                    {spreadsheets.filter(s => !s.is_completed).length > 0 && (
                                        <h3 className="text-xs font-bold text-text-secondary flex items-center gap-2 pt-4 border-t border-border-subtle px-1">
                                            📂 Planilhas Concluídas (Históricas)
                                        </h3>
                                    )}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {spreadsheets.filter(s => s.is_completed).map((sheet) => {
                                            const isPdf = sheet.filename.toLowerCase().endsWith('.pdf');
                                            return (
                                                <motion.div
                                                    key={sheet.id}
                                                    whileHover={{ y: -4 }}
                                                    onClick={() => handleSelectSpreadsheet(sheet)}
                                                    className="cursor-pointer flex flex-col rounded-[26px] border border-border-subtle bg-bg-card/70 p-5 shadow-soft hover:bg-bg-card hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-all group"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                                            isPdf 
                                                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/45 dark:text-rose-400' 
                                                                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/45 dark:text-emerald-400'
                                                        }`}>
                                                            <FileSpreadsheet className="h-5 w-5" />
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleDeleteSpreadsheet(sheet.id, e)}
                                                            className="p-2 text-text-tertiary hover:text-danger hover:bg-danger/5 rounded-xl transition"
                                                            title="Excluir arquivo"
                                                            aria-label="Excluir"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <h4 className="mt-4 text-xs font-bold text-text-primary group-hover:text-indigo-600 transition-colors line-clamp-1">
                                                        {sheet.filename}
                                                    </h4>
                                                    <p className="text-[10px] text-text-secondary mt-1 flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(sheet.uploaded_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <div className="mt-4 flex items-center gap-1.5 flex-wrap">
                                                        <Badge variant="neutral">{sheet.semester || 'Semestre N/A'}</Badge>
                                                        <Badge variant="neutral" className="line-clamp-1 max-w-[120px]">{sheet.course_name || 'Geral'}</Badge>
                                                        <Badge variant="neutral" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/65">Concluído</Badge>
                                                    </div>
                                                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-[10px] text-text-secondary">
                                                        <div>
                                                            <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Alunos</span>
                                                            <span className="font-semibold text-text-primary mt-0.5 block">{sheet.records_count}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Média</span>
                                                            <span className="font-semibold text-emerald-600 mt-0.5 block">{sheet.avg_grade ? sheet.avg_grade.toFixed(1) : '--'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-[9px] uppercase tracking-wider text-text-tertiary">Presença</span>
                                                            <span className="font-semibold text-text-primary mt-0.5 block">{sheet.avg_attendance ? `${sheet.avg_attendance.toFixed(0)}%` : '--'}</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Voltar e Header da Planilha Selecionada */}
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-secondary/40 border border-border-subtle p-4 rounded-3xl">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    setSelectedSpreadsheet(null);
                                    setSelectedWorkspace(null);
                                }}
                                icon={ArrowLeft}
                            >
                                Voltar
                            </Button>
                            <div>
                                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-accent-blue" />
                                    {selectedSpreadsheet.filename}
                                </h2>
                                <p className="text-xs text-text-secondary mt-0.5">
                                    Semestre: <strong>{selectedSpreadsheet.semester}</strong> | Curso: <strong>{selectedSpreadsheet.course_name}</strong>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex gap-2">
                                <Badge variant="info">{selectedSpreadsheet.records_count} alunos</Badge>
                                <Badge variant="success">Média: {selectedSpreadsheet.avg_grade?.toFixed(1) || '--'}</Badge>
                                <Badge variant="warning">Presença: {selectedSpreadsheet.avg_attendance?.toFixed(1) || '--'}%</Badge>
                            </div>
                            
                            <input
                                type="file"
                                ref={updateFileInputRef}
                                onChange={handleUpdateSpreadsheetFile}
                                accept=".csv,.xlsx,.xls,.txt,.pdf"
                                className="hidden"
                            />
                            <Button
                                size="sm"
                                variant="primary"
                                icon={Sparkles}
                                onClick={() => handleTriggerAiAnalysis()}
                                disabled={aiAnalysisLoading}
                                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-none shadow-soft"
                            >
                                {aiAnalysisLoading ? 'Analisando...' : 'Diagnóstico IA Preventivo ✨'}
                            </Button>
                            
                            <Button
                                size="sm"
                                variant="outline"
                                icon={Upload}
                                onClick={() => updateFileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? 'Processando...' : 'Carregar Dados por Cima'}
                            </Button>
                        </div>
                    </div>

                    {analysisLoading ? (
                        <Card>
                            <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-text-secondary">
                                <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
                                <span>Processando inteligência de risco e modelando o workspace para {selectedSpreadsheet.filename}...</span>
                            </div>
                        </Card>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] xl:grid-cols-[1.15fr_0.85fr]">
                                    
                                    {/* COLUNA ESQUERDA: ANALISE E INDICADORES DA PLANILHA EM ABAS */}
                                    <div className="space-y-4">
                                        {/* Seleção de Abas do Painel Acadêmico */}
                                        <div className="flex border-b border-border-subtle gap-2 px-1 bg-white/40 p-2 rounded-2xl border border-white/50 backdrop-blur-sm shadow-soft">
                                            <button
                                                type="button"
                                                onClick={() => setAnalysisTab('overview')}
                                                className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                                    analysisTab === 'overview'
                                                        ? 'bg-indigo-600 text-white shadow-soft'
                                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/50 dark:hover:bg-bg-card/50'
                                                }`}
                                            >
                                                Visão Geral &amp; Alertas
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAnalysisTab('predictions')}
                                                className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                                    analysisTab === 'predictions'
                                                        ? 'bg-violet-600 text-white shadow-soft'
                                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/50 dark:hover:bg-bg-card/50'
                                                }`}
                                            >
                                                Análises Preditivas ✨
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setAnalysisTab('students')}
                                                className={`flex-1 text-center py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                                                    analysisTab === 'students'
                                                        ? 'bg-indigo-600 text-white shadow-soft'
                                                        : 'text-text-secondary hover:text-text-primary hover:bg-white/50 dark:hover:bg-bg-card/50'
                                                }`}
                                            >
                                                Turmas &amp; Alunos ({records.length})
                                            </button>
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {analysisTab === 'overview' && (
                                                <motion.div
                                                    key="overview"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="grid gap-4 sm:grid-cols-2"
                                                >
                                                    <Card>
                                                        <CardHeader
                                                            title="Distribuição de Notas"
                                                            subtitle="Aproveitamento dos alunos por faixa de rendimento acadêmico."
                                                            icon={GraduationCap}
                                                        />
                                                        <div className="space-y-4 p-2 text-xs">
                                                            {gradesDistribution ? (
                                                                <>
                                                                    {/* Excelente */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between items-center text-text-secondary font-medium">
                                                                            <span>Excelente (≥ 8.0)</span>
                                                                            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                                                                                {gradesDistribution.excelente.count} ({gradesDistribution.excelente.pct}%)
                                                                            </span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${gradesDistribution.excelente.pct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                    {/* Bom */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between items-center text-text-secondary font-medium">
                                                                            <span>Bom (6.0 - 7.9)</span>
                                                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                                                {gradesDistribution.bom.count} ({gradesDistribution.bom.pct}%)
                                                                            </span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${gradesDistribution.bom.pct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                    {/* Atenção */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between items-center text-text-secondary font-medium">
                                                                            <span>Atenção (4.0 - 5.9)</span>
                                                                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                                                                {gradesDistribution.atencao.count} ({gradesDistribution.atencao.pct}%)
                                                                            </span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${gradesDistribution.atencao.pct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                    {/* Crítico */}
                                                                    <div className="space-y-1">
                                                                        <div className="flex justify-between items-center text-text-secondary font-medium">
                                                                            <span>Crítico (&lt; 4.0)</span>
                                                                            <span className="font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                                                                                {gradesDistribution.critico.count} ({gradesDistribution.critico.pct}%)
                                                                            </span>
                                                                        </div>
                                                                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                                                            <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${gradesDistribution.critico.pct}%` }} />
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <p className="text-text-secondary">Nenhum dado disponível.</p>
                                                            )}
                                                        </div>
                                                    </Card>

                                                    <Card>
                                                        <CardHeader
                                                            title="Disciplinas Gargalo"
                                                            subtitle="Rendimento médio e taxa de risco preventivo mapeado por disciplina."
                                                            icon={BookOpen}
                                                        />
                                                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-xs">
                                                            {subjectsSummary.length > 0 ? (
                                                                subjectsSummary.map((item) => {
                                                                    const isHighRisk = item.riskPercent >= 40.0;
                                                                    const isMediumRisk = item.riskPercent >= 20.0 && item.riskPercent < 40.0;
                                                                    let badgeVariant = "success";
                                                                    if (isHighRisk) badgeVariant = "danger";
                                                                    else if (isMediumRisk) badgeVariant = "warning";
                                                                    
                                                                    return (
                                                                        <div key={item.name} className="rounded-2xl border border-border-subtle bg-bg-secondary/20 p-4 transition hover:bg-bg-secondary/35">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <p className="font-bold text-text-primary text-xs">{item.name}</p>
                                                                                <Badge variant={badgeVariant}>
                                                                                    {item.riskPercent}% em Risco
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="mt-2.5 flex items-center justify-between text-[11px] text-text-secondary">
                                                                                <span>Média Geral: <span className="font-semibold text-text-primary">{item.avgGrade.toFixed(1)}</span></span>
                                                                                <span>{item.riskStudents} de {item.totalStudents} alunos</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <p className="text-text-secondary px-2">Nenhuma disciplina gargalo identificada.</p>
                                                            )}
                                                        </div>
                                                    </Card>

                                                    {/* CARD DE DIAGNÓSTICO PEDAGÓGICO PREVENTIVO ✨ */}
                                                    {preventiveStats && (
                                                        <div className="col-span-1 sm:col-span-2 mt-2">
                                                            <Card variant="hero" className="border-indigo-100 dark:border-indigo-950/40 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/10 dark:from-bg-card dark:via-bg-card dark:to-indigo-950/10 shadow-soft">
                                                                <div className="p-6">
                                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle/50 pb-5">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 shadow-sm">
                                                                                <Sparkles className="h-5 w-5 animate-pulse" />
                                                                            </div>
                                                                            <div>
                                                                                <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                                                                                    Diagnóstico Pedagógico Preventivo <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full font-semibold">IA Integrada</span>
                                                                                </h3>
                                                                                <p className="text-[11px] text-text-secondary mt-0.5">
                                                                                    Mapeamento em tempo real de vulnerabilidades acadêmicas da turma
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="primary"
                                                                            icon={Sparkles}
                                                                            onClick={() => handleTriggerAiAnalysis()}
                                                                            disabled={aiAnalysisLoading}
                                                                            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-none shadow-md"
                                                                        >
                                                                            {aiAnalysisLoading ? 'Processando IA...' : 'Gerar Plano de Intervenção IA ✨'}
                                                                        </Button>
                                                                    </div>

                                                                    {/* KPIs Principais de Risco */}
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                                                                        <div className="p-4 rounded-2xl border border-red-100 dark:border-red-950/30 bg-red-50/30 dark:bg-red-950/15 flex items-start gap-3.5 transition-all hover:shadow-soft">
                                                                            <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0 shadow-sm">
                                                                                <AlertCircle className="h-5 w-5" />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <p className="text-[10px] font-semibold text-red-800/80 dark:text-red-400/80 uppercase tracking-wider">
                                                                                    Taxa de Reprovação Projetada
                                                                                </p>
                                                                                <p className="text-xl font-black text-red-700 dark:text-red-400">
                                                                                    {preventiveStats.reprovacaoProjetadaPct}% <span className="text-[10px] font-medium text-red-600/70 dark:text-red-400/60">(Sem Intervenção)</span>
                                                                                </p>
                                                                                <p className="text-[11px] text-text-secondary leading-4">
                                                                                    Fração estimada da turma em situação de risco preventivo imediato (nota baixa ou baixa frequência).
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="p-4 rounded-2xl border border-amber-100 dark:border-amber-950/30 bg-amber-50/20 dark:bg-amber-950/15 flex items-start gap-3.5 transition-all hover:shadow-soft">
                                                                            <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
                                                                                <BarChart3 className="h-5 w-5" />
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                <p className="text-[10px] font-semibold text-amber-800/80 dark:text-amber-400/80 uppercase tracking-wider">
                                                                                    Gargalo de Assiduidade (Comportamental)
                                                                                </p>
                                                                                <p className="text-xl font-black text-amber-700 dark:text-amber-400">
                                                                                    {preventiveStats.correlacaoFaltaNotaPct}% <span className="text-[10px] font-medium text-amber-600/70 dark:text-amber-400/60">(Faltas vs Notas)</span>
                                                                                </p>
                                                                                <p className="text-[11px] text-text-secondary leading-4">
                                                                                    Dos alunos com frequência abaixo de 75%, esta é a proporção que também registra notas vermelhas (&lt; 6.0).
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Tabela de Quadrantes */}
                                                                    <div className="mt-6 border border-border-subtle rounded-2xl overflow-hidden bg-white/50 dark:bg-bg-card backdrop-blur-sm">
                                                                        <div className="px-4 py-3 bg-slate-50 dark:bg-bg-secondary border-b border-border-subtle flex justify-between items-center text-xs">
                                                                            <h4 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                                                                                Distribuição por Quadrantes de Monitoramento
                                                                            </h4>
                                                                            <span className="text-[10px] text-text-secondary font-medium">
                                                                                Total analisado: {preventiveStats.total} alunos
                                                                            </span>
                                                                        </div>
                                                                        <div className="divide-y divide-border-subtle text-xs">
                                                                            {/* Sem Risco */}
                                                                            <div className="px-4 py-3 flex items-center justify-between gap-4 transition-all hover:bg-slate-50/60 dark:hover:bg-bg-secondary/40">
                                                                                <div className="flex items-center gap-2.5 min-w-[200px]">
                                                                                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0" />
                                                                                    <div className="space-y-0.5">
                                                                                        <p className="font-bold text-text-primary">Sem Risco</p>
                                                                                        <p className="text-[10px] text-text-secondary">Média ≥ 6.0 e Presença ≥ 75%</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex-1 max-w-xs bg-slate-100 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden shrink-0 hidden md:block">
                                                                                    <div 
                                                                                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                                                                        style={{ width: `${(preventiveStats.aprovados / preventiveStats.total) * 100}%` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="text-right min-w-[80px]">
                                                                                    <Badge variant="success">
                                                                                        {preventiveStats.aprovados} ({((preventiveStats.aprovados / preventiveStats.total) * 100).toFixed(1)}%)
                                                                                    </Badge>
                                                                                </div>
                                                                            </div>

                                                                            {/* Risco de Reprovação por Nota */}
                                                                            <div className="px-4 py-3 flex items-center justify-between gap-4 transition-all hover:bg-slate-50/60 dark:hover:bg-bg-secondary/40">
                                                                                <div className="flex items-center gap-2.5 min-w-[200px]">
                                                                                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm shrink-0" />
                                                                                    <div className="space-y-0.5">
                                                                                        <p className="font-bold text-text-primary">Risco de Reprovação por Nota</p>
                                                                                        <p className="text-[10px] text-text-secondary">Média &lt; 6.0 e Presença ≥ 75%</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex-1 max-w-xs bg-slate-100 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden shrink-0 hidden md:block">
                                                                                    <div 
                                                                                        className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                                                                                        style={{ width: `${(preventiveStats.riscoNota / preventiveStats.total) * 100}%` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="text-right min-w-[80px]">
                                                                                    <Badge variant="warning">
                                                                                        {preventiveStats.riscoNota} ({((preventiveStats.riscoNota / preventiveStats.total) * 100).toFixed(1)}%)
                                                                                    </Badge>
                                                                                </div>
                                                                            </div>

                                                                            {/* Risco de Reprovação por Presença */}
                                                                            <div className="px-4 py-3 flex items-center justify-between gap-4 transition-all hover:bg-slate-50/60 dark:hover:bg-bg-secondary/40">
                                                                                <div className="flex items-center gap-2.5 min-w-[200px]">
                                                                                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-sm shrink-0" />
                                                                                    <div className="space-y-0.5">
                                                                                        <p className="font-bold text-text-primary">Risco de Reprovação por Presença</p>
                                                                                        <p className="text-[10px] text-text-secondary">Média ≥ 6.0 e Presença &lt; 75%</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex-1 max-w-xs bg-slate-100 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden shrink-0 hidden md:block">
                                                                                    <div 
                                                                                        className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                                                                                        style={{ width: `${(preventiveStats.riscoFalta / preventiveStats.total) * 100}%` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="text-right min-w-[80px]">
                                                                                    <Badge 
                                                                                        variant="warning"
                                                                                        className="bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/35 dark:text-orange-300 dark:border-orange-900/40"
                                                                                    >
                                                                                        {preventiveStats.riscoFalta} ({((preventiveStats.riscoFalta / preventiveStats.total) * 100).toFixed(1)}%)
                                                                                    </Badge>
                                                                                </div>
                                                                            </div>

                                                                            {/* Risco Crítico */}
                                                                            <div className="px-4 py-3 flex items-center justify-between gap-4 transition-all hover:bg-slate-50/60 dark:hover:bg-bg-secondary/40">
                                                                                <div className="flex items-center gap-2.5 min-w-[200px]">
                                                                                    <span className="h-2.5 w-2.5 rounded-full bg-red-600 shadow-sm shrink-0 animate-pulse" />
                                                                                    <div className="space-y-0.5">
                                                                                        <p className="font-bold text-text-primary flex items-center gap-1.5">
                                                                                            Risco Crítico (Nota e Presença)
                                                                                        </p>
                                                                                        <p className="text-[10px] text-text-secondary">Média &lt; 6.0 e Presença &lt; 75%</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex-1 max-w-xs bg-slate-100 dark:bg-slate-800/80 h-2 rounded-full overflow-hidden shrink-0 hidden md:block">
                                                                                    <div 
                                                                                        className="bg-red-600 h-full rounded-full transition-all duration-500" 
                                                                                        style={{ width: `${(preventiveStats.riscoAmbos / preventiveStats.total) * 100}%` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="text-right min-w-[80px]">
                                                                                    <Badge variant="danger">
                                                                                        {preventiveStats.riscoAmbos} ({((preventiveStats.riscoAmbos / preventiveStats.total) * 100).toFixed(1)}%)
                                                                                    </Badge>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </Card>
                                                        </div>
                                                    )}

                                                    {/* CARD DE ANALISE GRÁFICA COMPARATIVA */}
                                                    <div className="col-span-1 sm:col-span-2 mt-2">
                                                    <Card>
                                                             <CardHeader
                                                                 title="Análise Comparativa (Abismo de Rendimento)"
                                                                 subtitle="Compare o desempenho das melhores vs as piores turmas para identificar disparidades críticas"
                                                                 icon={BarChart3}
                                                             />
                                                             {allSpreadsheetClasses.length > 0 ? (
                                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
                                                                     {/* Gráfico 1: Notas Médias */}
                                                                     <div className="bg-bg-secondary/20 p-4 rounded-2xl border border-border-subtle">
                                                                         <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center justify-between">
                                                                             <span>Melhores vs Piores Turmas (Média de Notas)</span>
                                                                             <Badge variant="info">Nota Média</Badge>
                                                                         </h4>
                                                                         <div className="h-64">
                                                                             <ResponsiveContainer width="100%" height="100%">
                                                                                 <BarChart data={classesForGradeChart}>
                                                                                     <defs>
                                                                                         <linearGradient id="gradientHistoricalGrades" x1="0" y1="0" x2="0" y2="1">
                                                                                             <stop offset="0%" stopColor="#8F5BFF" stopOpacity={0.9} />
                                                                                             <stop offset="100%" stopColor="#6A1BFF" stopOpacity={0.5} />
                                                                                         </linearGradient>
                                                                                         <linearGradient id="gradientHistoricalGradesWorst" x1="0" y1="0" x2="0" y2="1">
                                                                                             <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                                                                                             <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.5} />
                                                                                         </linearGradient>
                                                                                     </defs>
                                                                                     <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                                                                     <XAxis dataKey="label" tick={false} stroke="#94a3b8" tickLine={false} axisLine={false} />
                                                                                     <YAxis domain={[0, 10]} stroke="#94a3b8" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                                                                     <Tooltip content={<CustomTooltip />} cursor={false} />
                                                                                     <ReferenceLine x=" ➔ | ➔ " stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 4" />
                                                                                     <Bar dataKey="avg_grade" radius={[10, 10, 0, 0]} name="Média de Notas" minPointSize={8}>
                                                                                         {classesForGradeChart.map((entry, index) => (
                                                                                             <Cell 
                                                                                                 key={`cell-grade-${index}`} 
                                                                                                 fill={entry.isSeparator ? "transparent" : (entry.isWorst ? "url(#gradientHistoricalGradesWorst)" : "url(#gradientHistoricalGrades)")} 
                                                                                             />
                                                                                         ))}
                                                                                     </Bar>
                                                                                 </BarChart>
                                                                             </ResponsiveContainer>
                                                                         </div>
                                                                         <p className="text-[10px] text-text-secondary mt-2 text-center">
                                                                             * Comparativo direto das melhores turmas (Roxo) vs as piores turmas (Vermelho) evidenciando o abismo pedagógico.
                                                                         </p>
                                                                     </div>

                                                                    {/* Gráfico 2: Presença Média */}
                                                                    <div className="bg-bg-secondary/20 p-4 rounded-2xl border border-border-subtle">
                                                                        <h4 className="text-xs font-semibold text-text-primary mb-3 flex items-center justify-between">
                                                                            <span>Melhores vs Piores Turmas (Média de Presença)</span>
                                                                            <Badge variant="purple">Frequência</Badge>
                                                                        </h4>
                                                                        <div className="h-64">
                                                                            <ResponsiveContainer width="100%" height="100%">
                                                                                <BarChart data={classesForAttendanceChart}>
                                                                                    <defs>
                                                                                        <linearGradient id="gradientHistoricalAttendance" x1="0" y1="0" x2="0" y2="1">
                                                                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                                                                                            <stop offset="100%" stopColor="#059669" stopOpacity={0.5} />
                                                                                        </linearGradient>
                                                                                        <linearGradient id="gradientHistoricalAttendanceWorst" x1="0" y1="0" x2="0" y2="1">
                                                                                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.9} />
                                                                                            <stop offset="100%" stopColor="#c2410c" stopOpacity={0.5} />
                                                                                        </linearGradient>
                                                                                    </defs>
                                                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                                                                    <XAxis dataKey="label" tick={false} stroke="#94a3b8" tickLine={false} axisLine={false} />
                                                                                    <YAxis domain={[0, 100]} stroke="#94a3b8" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                                                                    <Tooltip content={<CustomTooltip />} cursor={false} />
                                                                                    <ReferenceLine x=" ➔ | ➔ " stroke="#cbd5e1" strokeWidth={2} strokeDasharray="4 4" />
                                                                                    <Bar dataKey="avg_attendance" radius={[10, 10, 0, 0]} name="Presença (%)" minPointSize={8}>
                                                                                        {classesForAttendanceChart.map((entry, index) => (
                                                                                            <Cell 
                                                                                                key={`cell-attendance-${index}`} 
                                                                                                fill={entry.isSeparator ? "transparent" : (entry.isWorst ? "url(#gradientHistoricalAttendanceWorst)" : "url(#gradientHistoricalAttendance)")} 
                                                                                            />
                                                                                        ))}
                                                                                    </Bar>
                                                                                </BarChart>
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                        <p className="text-[10px] text-text-secondary mt-2 text-center">
                                                                            * Comparativo direto das melhores turmas em frequência (Verde) vs as piores turmas (Laranja/Coral) evidenciando a disparidade de engajamento.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="p-6 text-center text-xs text-text-secondary">
                                                                    Aguardando processamento analítico para exibir gráficos.
                                                                </div>
                                                            )}
                                                        </Card>
                                                    </div>

                                                    {/* CARD DE EVOLUÇÃO E PROJEÇÃO DAS NOTAS MÉDIAS DA TURMA */}
                                                    {evolutionChartData.length > 0 && (
                                                        <div className="col-span-1 sm:col-span-2 mt-2">
                                                            <Card>
                                                                <CardHeader
                                                                    title="Evolução e Projeção de Notas Médias da Turma"
                                                                    subtitle="Mapeamento da trajetória das médias de notas reais e projeções estimadas por IA"
                                                                    icon={Sparkles}
                                                                />
                                                                <div className="p-6 bg-white/70">
                                                                    <div className="h-72 w-full">
                                                                        <ResponsiveContainer width="100%" height="100%">
                                                                            <LineChart data={evolutionChartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                                                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                                                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                                                <Tooltip content={<CustomTooltip />} cursor={false} />
                                                                                {lastRealName && (
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
                                                                                <Legend 
                                                                                    verticalAlign="top" 
                                                                                    height={36} 
                                                                                    iconType="circle"
                                                                                    iconSize={8}
                                                                                    wrapperStyle={{ fontSize: 11, fontWeight: 500 }}
                                                                                />
                                                                                <Line
                                                                                    type="monotone"
                                                                                    dataKey="notaReal"
                                                                                    stroke="#0ea5e9"
                                                                                    strokeWidth={3}
                                                                                    dot={{ stroke: '#0ea5e9', strokeWidth: 2, fill: '#fff', r: 4 }}
                                                                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }}
                                                                                    name="Média Real da Turma"
                                                                                    connectNulls
                                                                                />
                                                                                <Line
                                                                                    type="monotone"
                                                                                    dataKey="notaProjetada"
                                                                                    stroke="#8b5cf6"
                                                                                    strokeWidth={3}
                                                                                    strokeDasharray="6 6"
                                                                                    dot={{ stroke: '#8b5cf6', strokeWidth: 2, fill: '#fff', r: 4 }}
                                                                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }}
                                                                                    name="Projeção Preditiva (IA) ✨"
                                                                                    connectNulls
                                                                                />
                                                                            </LineChart>
                                                                        </ResponsiveContainer>
                                                                    </div>
                                                                    <p className="mt-3 text-[11px] text-text-secondary leading-5 italic flex items-center gap-1">
                                                                        <span>✨ A linha pontilhada roxa indica projeções preditivas estimadas a partir de dados históricos de desempenho.</span>
                                                                    </p>
                                                                </div>
                                                            </Card>
                                                        </div>
                                                    )}

                                                    {/* LISTAGEM INDIVIDUAL DE ALUNOS (FOCO PREVENTIVO) */}
                                                    <div className="col-span-1 sm:col-span-2">
                                                        <Card>
                                                            <CardHeader
                                                                title="Situação Individual dos Alunos (Monitoramento Preventivo)"
                                                                subtitle="Detalhamento individualizado do status de risco de cada estudante desta planilha"
                                                                icon={Users}
                                                            />
                                                            <div className="p-5 border-t border-border-subtle bg-white/70">
                                                                {records.length > 0 ? (
                                                                    <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-white shadow-soft">
                                                                        <table className="w-full text-left border-collapse text-xs">
                                                                            <thead>
                                                                                <tr className="bg-bg-secondary/50 border-b border-border-subtle text-text-secondary font-semibold">
                                                                                    <th className="p-3.5">Nome do Aluno</th>
                                                                                    <th className="p-3.5">Disciplina</th>
                                                                                    <th className="p-3.5 text-center">Média</th>
                                                                                    {preventiveStats?.hasAttendanceData && <th className="p-3.5 text-center">Presença</th>}
                                                                                    <th className="p-3.5 text-center">Quadrante Preventivo</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-border-subtle">
                                                                                {records.map((r) => {
                                                                                    const grade = r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : 7.0;
                                                                                    const att = r.attendance !== null && r.attendance !== undefined ? parseFloat(r.attendance) : null;
                                                                                    const isNotaVermelha = grade < 6.0;
                                                                                    const isPresencaBaixa = preventiveStats?.hasAttendanceData && att !== null && att < 75.0;

                                                                                    let quadranteLabel = "Sem Risco";
                                                                                    let quadranteVariant = "success";

                                                                                    if (isNotaVermelha && isPresencaBaixa) {
                                                                                        quadranteLabel = "Risco Crítico (Nota e Presença)";
                                                                                        quadranteVariant = "danger";
                                                                                    } else if (isNotaVermelha && !isPresencaBaixa) {
                                                                                        quadranteLabel = "Risco de Reprovação por Nota";
                                                                                        quadranteVariant = "warning";
                                                                                    } else if (!isNotaVermelha && isPresencaBaixa) {
                                                                                        quadranteLabel = "Risco de Reprovação por Presença";
                                                                                        quadranteVariant = "info";
                                                                                    }

                                                                                    return (
                                                                                        <tr key={r.id} className="hover:bg-bg-secondary/20 transition">
                                                                                            <td className="p-3.5 font-bold text-text-primary">{r.student_name}</td>
                                                                                            <td className="p-3.5 text-text-secondary">{r.subject || 'Geral'}</td>
                                                                                            <td className="p-3.5 text-center font-semibold">
                                                                                                <span className={isNotaVermelha ? 'text-danger' : 'text-success'}>
                                                                                                    {formatGrade(r.grade_average)}
                                                                                                </span>
                                                                                            </td>
                                                                                            {preventiveStats?.hasAttendanceData && (
                                                                                                <td className="p-3.5 text-center font-semibold">
                                                                                                    <span className={isPresencaBaixa ? 'text-warning' : 'text-text-primary'}>
                                                                                                        {formatAttendance(r.attendance)}
                                                                                                    </span>
                                                                                                </td>
                                                                                            )}
                                                                                            <td className="p-3.5 text-center">
                                                                                                <Badge variant={quadranteVariant}>
                                                                                                    {quadranteLabel}
                                                                                                </Badge>
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-text-secondary text-center py-6">Nenhum aluno carregado nesta planilha.</p>
                                                                )}
                                                            </div>
                                                        </Card>
                                                    </div>

                                                </motion.div>
                                            )}

                                            {analysisTab === 'predictions' && (
                                                <motion.div
                                                    key="predictions"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                    className="space-y-4"
                                                >
                                                    {/* Cenário de Aprovação/Reprovação */}
                                                    {preventiveStats && (
                                                        <Card>
                                                            <CardHeader
                                                                title="Cenário Preditivo de Desfecho da Turma"
                                                                subtitle="Projeção do resultado final estimado para cada aluno com base nas notas e frequência atuais"
                                                                icon={Sparkles}
                                                            />
                                                            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                                <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center flex flex-col items-center gap-1">
                                                                    <span className="text-2xl font-black text-emerald-700">{preventiveStats.aprovados}</span>
                                                                    <span className="text-[11px] font-semibold text-emerald-800/70 uppercase tracking-wide">Sem Risco</span>
                                                                    <span className="text-[10px] text-text-secondary">{preventiveStats.total > 0 ? ((preventiveStats.aprovados / preventiveStats.total) * 100).toFixed(1) : 0}% da turma</span>
                                                                </div>
                                                                <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center flex flex-col items-center gap-1">
                                                                    <span className="text-2xl font-black text-amber-700">{preventiveStats.riscoNota}</span>
                                                                    <span className="text-[11px] font-semibold text-amber-800/70 uppercase tracking-wide">Risco de Reprovação por Nota</span>
                                                                    <span className="text-[10px] text-text-secondary">Nota abaixo de 6.0</span>
                                                                </div>
                                                                <div className="rounded-2xl bg-orange-50 border border-orange-100 p-4 text-center flex flex-col items-center gap-1">
                                                                    <span className="text-2xl font-black text-orange-700">{preventiveStats.riscoFalta}</span>
                                                                    <span className="text-[11px] font-semibold text-orange-800/70 uppercase tracking-wide">Risco de Reprovação por Presença</span>
                                                                    <span className="text-[10px] text-text-secondary">Frequência abaixo de 75%</span>
                                                                </div>
                                                                <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-center flex flex-col items-center gap-1">
                                                                    <span className="text-2xl font-black text-red-700">{preventiveStats.riscoAmbos}</span>
                                                                    <span className="text-[11px] font-semibold text-red-800/70 uppercase tracking-wide">Risco Crítico (Nota e Presença)</span>
                                                                    <span className="text-[10px] text-text-secondary">Nota E frequência baixas</span>
                                                                </div>
                                                            </div>
                                                            {/* Barra de projeção visual */}
                                                            <div className="px-5 pb-5">
                                                                <p className="text-[11px] font-semibold text-text-secondary mb-2">Distribuição Projetada da Turma</p>
                                                                <div className="flex h-5 rounded-full overflow-hidden gap-px">
                                                                    {preventiveStats.total > 0 && (
                                                                        <>
                                                                            <div className="bg-emerald-500 transition-all" style={{ width: `${(preventiveStats.aprovados / preventiveStats.total) * 100}%` }} title={`Aprovação: ${preventiveStats.aprovados}`} />
                                                                            <div className="bg-amber-400 transition-all" style={{ width: `${(preventiveStats.riscoNota / preventiveStats.total) * 100}%` }} title={`Risco Nota: ${preventiveStats.riscoNota}`} />
                                                                            <div className="bg-orange-400 transition-all" style={{ width: `${(preventiveStats.riscoFalta / preventiveStats.total) * 100}%` }} title={`Risco Falta: ${preventiveStats.riscoFalta}`} />
                                                                            <div className="bg-red-500 transition-all" style={{ width: `${(preventiveStats.riscoAmbos / preventiveStats.total) * 100}%` }} title={`Risco Duplo: ${preventiveStats.riscoAmbos}`} />
                                                                        </>
                                                                    )}
                                                                </div>
                                                                <div className="flex justify-between text-[10px] text-text-secondary mt-1.5">
                                                                    <span className="text-emerald-700 font-semibold">✅ Sem Risco</span>
                                                                    <span className="text-red-700 font-semibold">⚠️ Em Risco ({(+preventiveStats.reprovacaoProjetadaPct).toFixed(1)}%)</span>
                                                                </div>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* Gráfico de Evolução e Projeção */}
                                                    {evolutionChartData.length > 0 && (
                                                        <Card>
                                                            <CardHeader
                                                                title="Evolução e Projeção de Médias"
                                                                subtitle="Trajetória das notas reais e projeções preditivas até o desfecho final"
                                                                icon={Sparkles}
                                                            />
                                                            <div className="p-5 bg-white/70">
                                                                <div className="h-64 w-full">
                                                                    <ResponsiveContainer width="100%" height="100%">
                                                                        <LineChart data={evolutionChartData} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                                                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                                                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                                            <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                                                            <ReferenceLine y={6} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Mín. Aprovação', position: 'insideTopRight', fontSize: 9, fill: '#ef4444' }} />
                                                                            {lastRealName && (
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
                                                                            <Tooltip content={<CustomTooltip />} cursor={false} />
                                                                            <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 500 }} />
                                                                            <Line type="monotone" dataKey="notaReal" stroke="#0ea5e9" strokeWidth={3} dot={{ stroke: '#0ea5e9', strokeWidth: 2, fill: '#fff', r: 4 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#0ea5e9' }} name="Média Real da Turma" connectNulls />
                                                                            <Line type="monotone" dataKey="notaProjetada" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="6 6" dot={{ stroke: '#8b5cf6', strokeWidth: 2, fill: '#fff', r: 4 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }} name="Projeção Preditiva (IA) ✨" connectNulls />
                                                                        </LineChart>
                                                                    </ResponsiveContainer>
                                                                </div>
                                                                <p className="mt-2 text-[10px] text-text-secondary italic">A linha vermelha tracejada marca a nota mínima de aprovação (6.0). Alunos cuja projeção estiver abaixo desse limiar requerem intervenção imediata.</p>
                                                            </div>
                                                        </Card>
                                                    )}

                                                    {/* Ranking de Alunos em Risco */}
                                                    <Card>
                                                        <CardHeader
                                                            title="Ranking de Risco Individual (Top Prioridade)"
                                                            subtitle="Alunos ordenados por gravidade do risco preditivo — intervenha pelos primeiros da lista"
                                                            icon={AlertCircle}
                                                        />
                                                        <div className="p-4">
                                                            {records.length > 0 ? (
                                                                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                                                                    {[...records]
                                                                        .map(r => {
                                                                            const grade = r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : 7.0;
                                                                            const att = r.attendance !== null && r.attendance !== undefined ? parseFloat(r.attendance) : null;
                                                                            const gradeRisk = grade < 6.0 ? (6.0 - grade) / 6.0 : 0;
                                                                            const attRisk = att !== null && att < 75 ? (75 - att) / 75 : 0;
                                                                            const riskScore = parseFloat(((gradeRisk * 0.6 + attRisk * 0.4) * 100).toFixed(1));
                                                                            return { ...r, riskScore, grade, att };
                                                                        })
                                                                        .filter(r => r.riskScore > 0)
                                                                        .sort((a, b) => b.riskScore - a.riskScore)
                                                                        .slice(0, 15)
                                                                        .map((r, idx) => {
                                                                            const isHigh = r.riskScore >= 50;
                                                                            const isMed = r.riskScore >= 25 && r.riskScore < 50;
                                                                            return (
                                                                                <div key={r.id || idx} className={`flex items-center gap-3 p-3 rounded-2xl border text-xs transition-all hover:shadow-soft ${
                                                                                    isHigh ? 'border-red-100 bg-red-50/40' : isMed ? 'border-amber-100 bg-amber-50/30' : 'border-border-subtle bg-bg-secondary/10'
                                                                                }`}>
                                                                                    <span className={`text-[11px] font-black w-5 text-center ${
                                                                                        isHigh ? 'text-red-600' : isMed ? 'text-amber-600' : 'text-text-secondary'
                                                                                    }`}>{idx + 1}</span>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="font-semibold text-text-primary truncate">{r.student_name}</p>
                                                                                        <p className="text-text-secondary text-[10px] truncate">{r.subject || r.course_name}</p>
                                                                                    </div>
                                                                                    <div className="text-right shrink-0 space-y-0.5">
                                                                                        <p className="font-bold" style={{ color: r.grade < 6 ? '#dc2626' : '#059669' }}>Nota: {r.grade.toFixed(1)}</p>
                                                                                        {r.att !== null && <p className="text-[10px] text-text-secondary">Freq: {r.att.toFixed(0)}%</p>}
                                                                                    </div>
                                                                                    <div className={`text-[11px] font-black px-2 py-1 rounded-xl ${
                                                                                        isHigh ? 'text-red-700 bg-red-100' : isMed ? 'text-amber-700 bg-amber-100' : 'text-slate-600 bg-slate-100'
                                                                                    }`}>
                                                                                        {r.riskScore}%
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    }
                                                                    {records.filter(r => {
                                                                        const grade = r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : 7.0;
                                                                        const att = r.attendance !== null && r.attendance !== undefined ? parseFloat(r.attendance) : null;
                                                                        const gradeRisk = grade < 6.0 ? (6.0 - grade) / 6.0 : 0;
                                                                        const attRisk = att !== null && att < 75 ? (75 - att) / 75 : 0;
                                                                        return (gradeRisk * 0.6 + attRisk * 0.4) === 0;
                                                                    }).length === records.length && (
                                                                        <div className="py-6 text-center text-xs text-emerald-600 font-semibold">
                                                                            ✅ Nenhum aluno em risco detectado! A turma está com ótimo desempenho.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <p className="py-6 text-center text-xs text-text-secondary">Nenhum registro disponível.</p>
                                                            )}
                                                        </div>
                                                    </Card>

                                                    {/* Correlação Frequência x Nota (Scatter simplificado como BarChart) */}
                                                    {preventiveStats?.hasAttendanceData && (
                                                        <Card>
                                                            <CardHeader
                                                                title="Correlação Frequência x Desempenho"
                                                                subtitle="Análise comparativa do rendimento escolar com base na assiduidade do estudante"
                                                                icon={BarChart3}
                                                            />
                                                            <div className="p-5 bg-white/70 dark:bg-bg-card/70">
                                                                {(() => {
                                                                    const alunosAssiduos = records.filter(r => {
                                                                        const att = r.attendance !== null && r.attendance !== undefined ? parseFloat(r.attendance) : null;
                                                                        return att !== null && att >= 75.0;
                                                                    });
                                                                    const alunosInfrequentes = records.filter(r => {
                                                                        const att = r.attendance !== null && r.attendance !== undefined ? parseFloat(r.attendance) : null;
                                                                        return att !== null && att < 75.0;
                                                                    });

                                                                    const mediaAssiduos = alunosAssiduos.length > 0
                                                                        ? (alunosAssiduos.reduce((sum, r) => sum + (r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : 7.0), 0) / alunosAssiduos.length)
                                                                        : null;

                                                                    const mediaInfrequentes = alunosInfrequentes.length > 0
                                                                        ? (alunosInfrequentes.reduce((sum, r) => sum + (r.grade_average !== null && r.grade_average !== undefined ? parseFloat(r.grade_average) : 7.0), 0) / alunosInfrequentes.length)
                                                                        : null;

                                                                    const temDados = records.some(r => r.attendance !== null && r.attendance !== undefined);

                                                                    return temDados ? (
                                                                        <div className="space-y-5">
                                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                                {/* Grupo Assíduo */}
                                                                                <div className="p-4 rounded-2xl border border-emerald-100 dark:border-emerald-950/35 bg-emerald-50/20 dark:bg-emerald-950/15 flex flex-col justify-between gap-3 shadow-sm">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">
                                                                                            Alunos Assíduos (≥ 75%)
                                                                                        </span>
                                                                                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                                                                            {alunosAssiduos.length} Alunos
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-baseline gap-2">
                                                                                        <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                                                                            {mediaAssiduos !== null ? mediaAssiduos.toFixed(2) : '--'}
                                                                                        </span>
                                                                                        <span className="text-[11px] text-text-secondary">Média de Notas</span>
                                                                                    </div>
                                                                                    <p className="text-[11px] text-text-secondary leading-relaxed">
                                                                                        Estudantes com presença estável e dentro da recomendação institucional apresentam melhor absorção de conteúdo e rendimento.
                                                                                    </p>
                                                                                </div>

                                                                                {/* Grupo Infrequente */}
                                                                                <div className="p-4 rounded-2xl border border-orange-100 dark:border-orange-950/35 bg-orange-50/20 dark:bg-orange-950/15 flex flex-col justify-between gap-3 shadow-sm">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <span className="text-[10px] font-bold text-orange-800 dark:text-orange-400 uppercase tracking-wider">
                                                                                            Faltas Excessivas (&lt; 75%)
                                                                                        </span>
                                                                                        <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full font-bold">
                                                                                            {alunosInfrequentes.length} Alunos
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex items-baseline gap-2">
                                                                                        <span className="text-3xl font-black text-orange-600 dark:text-orange-400">
                                                                                            {mediaInfrequentes !== null ? mediaInfrequentes.toFixed(2) : '--'}
                                                                                        </span>
                                                                                        <span className="text-[11px] text-text-secondary">Média de Notas</span>
                                                                                    </div>
                                                                                    <p className="text-[11px] text-text-secondary leading-relaxed">
                                                                                        A infrequência excessiva é o principal indicador comportamental associado à queda de desempenho e risco de reprovação.
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            {/* Barra de comparação visual */}
                                                                            {mediaAssiduos !== null && mediaInfrequentes !== null && (
                                                                                <div className="p-3.5 rounded-xl bg-bg-secondary/40 dark:bg-bg-secondary border border-border-subtle text-xs space-y-2">
                                                                                    <div className="flex justify-between items-center text-[10px] text-text-secondary uppercase tracking-wider font-semibold">
                                                                                        <span>Diferença de Desempenho</span>
                                                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                                                            +{(mediaAssiduos - mediaInfrequentes).toFixed(2)} pontos para alunos assíduos
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="flex h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 gap-px">
                                                                                        <div className="bg-emerald-500 transition-all" style={{ width: `${(mediaAssiduos / (mediaAssiduos + mediaInfrequentes)) * 100}%` }} title={`Assíduos: ${mediaAssiduos.toFixed(1)}`} />
                                                                                        <div className="bg-orange-500 transition-all" style={{ width: `${(mediaInfrequentes / (mediaAssiduos + mediaInfrequentes)) * 100}%` }} title={`Infrequentes: ${mediaInfrequentes.toFixed(1)}`} />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="py-4 text-center text-xs text-text-secondary">Dados de frequência insuficientes para gerar a análise.</p>
                                                                    );
                                                                })()}
                                                                <p className="mt-4 text-[10px] text-text-secondary italic">
                                                                    A análise compara o rendimento médio dos alunos que cumprem a frequência mínima regulamentar (75%) em relação aos alunos infrequentes sob risco de reprovação.
                                                                </p>
                                                            </div>
                                                        </Card>
                                                    )}
                                                </motion.div>
                                            )}

                                            {analysisTab === 'students' && (
                                                <motion.div
                                                    key="students"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -10 }}
                                                >
                                                    <Card>
                                                        <CardHeader
                                                            title="Alunos e Desempenho Acadêmico"
                                                            subtitle="Gerencie alunos, notas e presenças de forma interativa nesta planilha."
                                                            icon={Users}
                                                            action={
                                                                <Button
                                                                    size="sm"
                                                                    variant="primary"
                                                                    onClick={handleOpenAddModal}
                                                                >
                                                                    + Adicionar Aluno
                                                                </Button>
                                                            }
                                                        />
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <Badge variant="neutral">{groupedRecords.length} turmas</Badge>
                                                                <Badge variant="info">{records.length} registros</Badge>
                                                            </div>
                                                            <div className="flex flex-col gap-2 sm:flex-row">
                                                                <label className="relative">
                                                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                                                                    <input
                                                                        value={searchTerm}
                                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                                        placeholder="Buscar aluno..."
                                                                        className="h-10 w-full sm:w-[200px] rounded-xl border border-border-subtle bg-white pl-10 pr-4 text-xs outline-none focus:border-indigo-500"
                                                                    />
                                                                </label>
                                                                <Button
                                                                    size="sm"
                                                                    variant={showAttentionOnly ? 'primary' : 'secondary'}
                                                                    onClick={() => setShowAttentionOnly(prev => !prev)}
                                                                >
                                                                    {showAttentionOnly ? 'Todos' : 'Em Risco'}
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {filteredRecordsList.length > 0 ? (
                                                            <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-white shadow-soft max-h-[460px] overflow-y-auto">
                                                                <table className="w-full text-left border-collapse text-xs">
                                                                    <thead>
                                                                        <tr className="bg-bg-secondary/50 border-b border-border-subtle text-text-secondary font-semibold">
                                                                            <th className="p-3.5">Nome do Aluno</th>
                                                                            <th className="p-3.5">Curso</th>
                                                                            <th className="p-3.5">Disciplina</th>
                                                                            <th className="p-3.5 text-center">Média</th>
                                                                            <th className="p-3.5 text-center">Frequência</th>
                                                                            <th className="p-3.5 text-center">Situação</th>
                                                                            <th className="p-3.5 text-center">Ações</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-border-subtle">
                                                                        {filteredRecordsList.map((r) => (
                                                                            <tr key={r.id} className="hover:bg-bg-secondary/20 transition">
                                                                                <td className="p-3.5 font-bold text-text-primary">{r.student_name}</td>
                                                                                <td className="p-3.5">
                                                                                    <Badge variant="neutral">{r.course_name || selectedSpreadsheet.course_name}</Badge>
                                                                                </td>
                                                                                <td className="p-3.5 text-text-secondary">{r.subject || 'Geral'}</td>
                                                                                <td className="p-3.5 text-center font-semibold">
                                                                                    <span className={r.grade_average < 6.0 ? 'text-danger' : 'text-success'}>
                                                                                        {formatGrade(r.grade_average)}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="p-3.5 text-center font-semibold">
                                                                                    <span className={r.attendance < 75.0 ? 'text-warning' : 'text-text-primary'}>
                                                                                        {formatAttendance(r.attendance)}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="p-3.5 text-center">
                                                                                    <Badge variant={getStudentStatusVariant(r.status_label, r.attendance, r.grade_average)}>
                                                                                        {r.status_label || getAttendanceSignal(r.attendance, r.grade_average)}
                                                                                    </Badge>
                                                                                </td>
                                                                                <td className="p-3.5 text-center">
                                                                                    <div className="flex items-center justify-center gap-2">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleOpenEditModal(r)}
                                                                                            className="rounded-lg p-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-855 transition text-base"
                                                                                            title="Editar Aluno"
                                                                                        >
                                                                                            ✏️
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => handleDeleteStudentRecord(r.id)}
                                                                                            className="rounded-lg p-1.5 text-danger hover:bg-danger/8 hover:text-danger/90 transition"
                                                                                            title="Excluir Aluno"
                                                                                        >
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <EmptyState
                                                                icon={Search}
                                                                title="Nenhum registro correspondente"
                                                                description="Tente redefinir a sua busca ou adicione um novo aluno de forma interativa."
                                                            />
                                                        )}
                                                    </Card>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* COLUNA DIREITA: PAINEL INTEGRADO DO CHAT DE IA */}
                                    <div className="flex flex-col">
                                        <Card className="flex flex-col h-[650px] bg-bg-card border border-border-subtle rounded-3xl overflow-hidden shadow-medium">
                                            {/* Header do Chat */}
                                            <div className="flex items-center justify-between border-b border-border-subtle bg-gradient-to-r from-indigo-50/50 to-purple-50/30 dark:from-indigo-950/30 dark:to-purple-950/20 px-5 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-soft">
                                                        <Sparkles className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-text-primary flex items-center gap-1">
                                                            NEXORA IA Assistente
                                                        </h3>
                                                        <p className="text-[11px] text-text-secondary mt-0.5">Focado em: {selectedSpreadsheet.filename}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="info">Conectado</Badge>
                                            </div>

                                            {/* Histórico do Chat */}
                                            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                                                {chatMessages.map((msg, idx) => (
                                                    <div
                                                        key={idx}
                                                        className={[
                                                            'flex w-full',
                                                            msg.role === 'user' ? 'justify-end' : 'justify-start'
                                                        ].join(' ')}
                                                    >
                                                        <div className={[
                                                            'max-w-[85%] rounded-[24px] px-4 py-3 text-[13px] leading-relaxed shadow-soft border',
                                                            msg.role === 'user'
                                                                ? 'bg-indigo-600 text-white border-indigo-700 rounded-tr-none'
                                                                : msg.role === 'system'
                                                                    ? 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300 border-indigo-150/50 dark:border-indigo-900/40 rounded-tl-none'
                                                                    : 'bg-slate-800 dark:bg-slate-900 text-white border-slate-700/80 rounded-tl-none'
                                                        ].join(' ')}>
                                                            {msg.role === 'user' ? msg.content : <MarkdownRenderer text={msg.content} />}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Indicador de carregamento */}
                                                {chatLoading && (
                                                    <div className="flex justify-start">
                                                        <div className="bg-slate-800 dark:bg-slate-900 text-white border border-slate-700/80 rounded-[24px] rounded-tl-none px-4 py-3 text-xs flex items-center gap-2">
                                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                                            <span>Analisando o histórico acadêmico...</span>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={chatEndRef} />
                                            </div>

                                            {/* Perguntas Rápidas */}
                                            {chatMessages.length <= 2 && !chatLoading && (
                                                <div className="border-t border-border-subtle bg-bg-secondary/20 p-4">
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-2">Sugestões de Perguntas</p>
                                                    <div className="grid gap-2">
                                                        {quickQuestions.map((q) => (
                                                            <button
                                                                key={q}
                                                                onClick={() => handleSendSheetChatMessage(q)}
                                                                className="text-left bg-bg-card border border-border-subtle hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:bg-indigo-50/20 dark:hover:bg-bg-card-hover text-[11px] text-text-secondary hover:text-indigo-700 px-3.5 py-2.5 rounded-2xl transition"
                                                            >
                                                                {q}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Input do Chat */}
                                            <div className="border-t border-border-subtle p-4 bg-bg-card">
                                                <form
                                                    onSubmit={(e) => {
                                                        e.preventDefault();
                                                        handleSendSheetChatMessage();
                                                    }}
                                                    className="flex gap-2"
                                                >
                                                    <input
                                                        value={chatInput}
                                                        onChange={(e) => setChatInput(e.target.value)}
                                                        placeholder="Pergunte sobre alunos, rendimentos ou disciplinas..."
                                                        className="h-11 flex-1 rounded-2xl border border-border-subtle dark:border-border-subtle bg-bg-secondary/40 dark:bg-bg-secondary px-4 text-xs text-text-primary outline-none focus:border-indigo-500"
                                                        disabled={chatLoading}
                                                    />
                                                    <Button
                                                        type="submit"
                                                        disabled={!chatInput.trim() || chatLoading}
                                                        icon={Send}
                                                    >
                                                        Enviar
                                                    </Button>
                                                </form>
                                            </div>
                                        </Card>
                                    </div>

                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Criação e Edição de Aluno na Planilha */}
            <AnimatePresence>
                {isAddEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !addEditLoading && setIsAddEditModalOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Modal Container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="relative w-full max-w-lg rounded-3xl border border-border-subtle bg-white p-6 shadow-heavy z-10"
                        >
                            <div className="flex items-center justify-between border-b border-border-subtle pb-4 mb-4">
                                <h3 className="text-sm font-bold text-text-primary">
                                    {editingRecord ? '✏️ Editar Aluno' : '✨ Adicionar Aluno na Planilha'}
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => !addEditLoading && setIsAddEditModalOpen(false)}
                                    className="rounded-xl p-1 text-text-tertiary hover:bg-bg-secondary hover:text-text-primary transition"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setAddEditLoading(true);
                                const formData = new FormData(e.target);
                                const payload = {
                                    spreadsheet_id: selectedSpreadsheet.id,
                                    student_name: formData.get('student_name'),
                                    course_name: formData.get('course_name'),
                                    subject: formData.get('subject'),
                                    attendance: formData.get('attendance') ? parseFloat(formData.get('attendance')) : null,
                                    grades: { "média": formData.get('grade') ? parseFloat(formData.get('grade')) : 0.0 },
                                    period: formData.get('period') ? parseInt(formData.get('period')) : null,
                                    semester: selectedSpreadsheet.semester
                                };

                                try {
                                    if (editingRecord) {
                                        await api.put(`/historical-data/records/${editingRecord.id}`, payload);
                                    } else {
                                        await api.post('/historical-data/records', payload);
                                    }

                                    // Recarregar dados locais
                                    const recordsRes = await api.get('/historical-data', {
                                        params: { page: 1, page_size: 150, spreadsheet_id: selectedSpreadsheet.id }
                                    });
                                    setRecords(recordsRes.data?.records || []);

                                    // Recarregar planilhas
                                    const sheetsRes = await api.get('/historical-data/spreadsheets');
                                    const updatedSheet = (sheetsRes.data || []).find(s => s.id === selectedSpreadsheet.id);
                                    if (updatedSheet) {
                                        setSelectedSpreadsheet(updatedSheet);
                                    }

                                    setIsAddEditModalOpen(false);
                                } catch (err) {
                                    console.error('Erro ao salvar registro de aluno', err);
                                    alert('Erro ao salvar dados do aluno. Verifique se os campos foram preenchidos corretamente.');
                                } finally {
                                    setAddEditLoading(false);
                                }
                            }} className="space-y-4 text-xs">
                                <div>
                                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">Nome do Aluno</label>
                                    <input
                                        required
                                        name="student_name"
                                        defaultValue={editingRecord?.student_name || ''}
                                        placeholder="Ex: João da Silva"
                                        className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Curso Acadêmico</label>
                                        <input
                                            required
                                            name="course_name"
                                            defaultValue={editingRecord?.course_name || selectedSpreadsheet?.course_name || ''}
                                            placeholder="Ex: Engenharia de Software"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Disciplina / Matéria</label>
                                        <input
                                            required
                                            name="subject"
                                            defaultValue={editingRecord?.subject || ''}
                                            placeholder="Ex: Banco de Dados"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Média Final (0-10)</label>
                                        <input
                                            required
                                            name="grade"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            defaultValue={editingRecord?.grade_average != null ? editingRecord.grade_average : ''}
                                            placeholder="Ex: 7.5"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Frequência % (0-100)</label>
                                        <input
                                            required
                                            name="attendance"
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="100"
                                            defaultValue={editingRecord?.attendance != null ? editingRecord.attendance : ''}
                                            placeholder="Ex: 85"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">Período Acadêmico</label>
                                        <input
                                            name="period"
                                            type="number"
                                            min="1"
                                            max="16"
                                            defaultValue={editingRecord?.period != null ? editingRecord.period : ''}
                                            placeholder="Ex: 2"
                                            className="h-11 w-full rounded-2xl border border-border-subtle bg-white px-4 text-xs text-text-primary outline-none focus:border-indigo-500 transition"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-4 mt-6">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={addEditLoading}
                                        onClick={() => setIsAddEditModalOpen(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        loading={addEditLoading}
                                    >
                                        {editingRecord ? 'Salvar' : 'Adicionar'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal de Aluno */}
            <StudentDetailModal
                studentId={selectedStudentId}
                isOpen={Boolean(selectedStudentId)}
                onClose={() => setSelectedStudentId(null)}
            />

            {/* Modal de Analise com IA Premium */}
            <AnimatePresence>
                {showAiAnalysisModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !aiAnalysisLoading && setShowAiAnalysisModal(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        />

                        {/* Modal Container */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ type: 'spring', duration: 0.5 }}
                            className="relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[28px] border border-white/20 bg-white/70 backdrop-blur-md shadow-2xl flex flex-col z-10"
                        >
                            {/* Decorative background gradients */}
                            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-[80px]" />
                            <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-violet-500/10 blur-[80px]" />

                            {/* Header */}
                            <div className="relative border-b border-border-subtle p-6 flex items-center justify-between bg-white/20 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600">
                                        <Sparkles className="h-5 w-5 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                                            Inteligência Pedagógica NEXORA
                                        </h3>
                                        <p className="text-xs text-text-secondary mt-0.5">
                                            Varredura analítica de IA sobre **{selectedSpreadsheet?.filename || 'Planilha'}**
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !aiAnalysisLoading && setShowAiAnalysisModal(false)}
                                    className="p-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-white/50 transition-all border border-transparent hover:border-white/20"
                                    disabled={aiAnalysisLoading}
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="relative flex-1 p-6 overflow-y-auto min-h-[300px]">
                                {aiAnalysisLoading ? (
                                    <div className="flex flex-col items-center justify-center min-h-[350px] gap-4 text-center">
                                        <div className="relative h-16 w-16 flex items-center justify-center">
                                            <div className="absolute inset-0 rounded-full border-4 border-indigo-600/10" />
                                            <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
                                            <Sparkles className="h-6 w-6 text-indigo-600 animate-pulse" />
                                        </div>
                                        <div className="space-y-2 max-w-md">
                                            <h4 className="text-sm font-bold text-text-primary">
                                                Processando Inteligência Generativa...
                                            </h4>
                                            <p className="text-xs text-text-secondary leading-5">
                                                <LoadingTextRotator />
                                            </p>
                                        </div>
                                    </div>
                                ) : aiAnalysisResult ? (
                                    <div className="space-y-6 animate-fade-in">
                                        {/* KPIs rápidos no topo do relatório */}
                                        {aiAnalysisResult.kpis && (
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 bg-white/30 p-3 rounded-2xl border border-white/40">
                                                <div className="text-center p-2">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Alunos</p>
                                                    <p className="text-sm font-bold text-text-primary mt-0.5">{aiAnalysisResult.kpis.total_records}</p>
                                                </div>
                                                <div className="text-center p-2 border-l border-border-subtle">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Média Geral</p>
                                                    <p className="text-sm font-bold text-text-primary mt-0.5">{aiAnalysisResult.kpis.avg_grade}</p>
                                                </div>
                                                <div className="text-center p-2 border-l border-border-subtle">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Presença Média</p>
                                                    <p className="text-sm font-bold text-text-primary mt-0.5">{aiAnalysisResult.kpis.avg_attendance}%</p>
                                                </div>
                                                <div className="text-center p-2 border-l border-border-subtle">
                                                    <p className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Alunos em Risco</p>
                                                    <p className="text-sm font-bold text-red-600 mt-0.5">{aiAnalysisResult.kpis.at_risk_count}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Relatório formatado em Markdown */}
                                        <div className="prose max-w-none text-text-primary bg-white/40 border border-white/30 p-6 rounded-[24px] shadow-sm">
                                            <MarkdownRenderer text={aiAnalysisResult.analysis_report} />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center min-h-[300px] text-text-secondary gap-3">
                                        <AlertCircle className="h-8 w-8 text-red-500" />
                                        <span>Nenhum relatório pôde ser gerado para este arquivo.</span>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="relative border-t border-border-subtle p-5 bg-white/20 backdrop-blur-sm flex items-center justify-between">
                                <div className="text-[10px] text-text-secondary flex items-center gap-1.5">
                                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                                    Google Gemini Integrado | Respostas e análises 100% em pt-BR
                                </div>
                                <div className="flex gap-2">
                                    {aiAnalysisResult && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                if (aiAnalysisResult?.analysis_report) {
                                                    navigator.clipboard.writeText(aiAnalysisResult.analysis_report);
                                                    setCopiedReport(true);
                                                    setTimeout(() => setCopiedReport(false), 2000);
                                                }
                                            }}
                                            icon={copiedReport ? Check : Copy}
                                        >
                                            {copiedReport ? 'Copiado!' : 'Copiar Relatório'}
                                        </Button>
                                    )}
                                    <Button
                                        variant="secondary"
                                        onClick={() => handleTriggerAiAnalysis()}
                                        disabled={aiAnalysisLoading}
                                        icon={Sparkles}
                                    >
                                        Gerar Novamente
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={() => setShowAiAnalysisModal(false)}
                                        disabled={aiAnalysisLoading}
                                    >
                                        Concluído
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function buildGroupedRecords(records = [], filters = {}) {
    const normalizedSearch = normalizeText(filters.searchTerm || '');
    const groups = new Map();

    records.forEach((record) => {
        const matchesSearch = !normalizedSearch || [
            record.student_name,
            record.subject,
            record.course_name,
            record.registration_number,
        ].some((value) => normalizeText(value).includes(normalizedSearch));

        if (!matchesSearch) {
            return;
        }

        if (filters.showAttentionOnly && !isAttentionStudent(record)) {
            return;
        }

        const semester = record.semester || 'Sem semestre';
        const subject = record.subject || 'Turma sem disciplina';
        const courseName = record.course_name || 'Curso não informado';
        const periodLabel = record.period ? `${record.period}o período` : 'Período não informado';
        const key = record.class_key || `${semester}::${courseName}::${subject}::${periodLabel}`;

        if (!groups.has(key)) {
            groups.set(key, {
                key,
                semester,
                subject,
                courseName,
                periodLabel,
                students: [],
            });
        }

        groups.get(key).students.push(record);
    });

    return Array.from(groups.values())
        .map((group) => {
            const uniqueStudents = new Set(group.students.map((item) => item.student_name).filter(Boolean));
            const attendanceValues = group.students.map((item) => toNumber(item.attendance)).filter((value) => value != null);
            const gradeValues = group.students.map((item) => toNumber(item.grade_average)).filter((value) => value != null);
            const attentionCount = group.students.filter((item) => isAttentionStudent(item)).length;

            return {
                ...group,
                studentCount: uniqueStudents.size,
                avgAttendance: average(attendanceValues),
                avgGrade: average(gradeValues),
                attentionCount,
                students: [...group.students].sort((left, right) => {
                    const leftScore = scoreStudentAttention(left);
                    const rightScore = scoreStudentAttention(right);
                    return rightScore - leftScore || String(left.student_name || '').localeCompare(String(right.student_name || ''));
                }),
            };
        })
        .sort((left, right) => right.attentionCount - left.attentionCount || String(left.subject).localeCompare(String(right.subject)));
}

function scoreStudentAttention(record) {
    const attendance = toNumber(record.attendance);
    const gradeAverage = toNumber(record.grade_average);
    let score = 0;

    if (attendance != null) {
        score += Math.max(0, 100 - attendance);
    }
    if (gradeAverage != null) {
        score += Math.max(0, (10 - gradeAverage) * 10);
    }
    if (record.status_label && /reprov|risco|alerta/i.test(record.status_label)) {
        score += 25;
    }

    return score;
}

function isAttentionStudent(record) {
    const attendance = toNumber(record.attendance);
    const gradeAverage = toNumber(record.grade_average);
    return (
        (attendance != null && attendance < 75) ||
        (gradeAverage != null && gradeAverage < 6) ||
        Boolean(record.status_label && /reprov|risco|alerta/i.test(record.status_label))
    );
}

function getAttendanceSignal(attendance, gradeAverage) {
    const attendanceValue = toNumber(attendance);
    const gradeValue = toNumber(gradeAverage);

    if ((attendanceValue != null && attendanceValue < 75) || (gradeValue != null && gradeValue < 6)) {
        return 'Atenção';
    }
    if ((attendanceValue != null && attendanceValue < 85) || (gradeValue != null && gradeValue < 7)) {
        return 'Monitorar';
    }
    return 'Estável';
}

function getStudentStatusVariant(statusLabel, attendance, gradeAverage) {
    if (statusLabel && /reprov/i.test(statusLabel)) {
        return 'danger';
    }

    const signal = getAttendanceSignal(attendance, gradeAverage);
    if (signal === 'Atenção') {
        return 'warning';
    }
    if (signal === 'Monitorar') {
        return 'info';
    }
    return 'success';
}

function formatAttendance(value) {
    const numericValue = toNumber(value);
    return numericValue != null ? `${numericValue.toFixed(1)}%` : '--';
}

function formatGrade(value) {
    const numericValue = toNumber(value);
    return numericValue != null ? numericValue.toFixed(1) : '--';
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function average(values = []) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length;
}

function sumStudents(groups = []) {
    return groups.reduce((sum, group) => sum + Number(group.studentCount || 0), 0);
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

function LoadingTextRotator() {
    const messages = [
        'Realizando varredura pedagógica nos registros do arquivo...',
        'Analisando notas médias das avaliações (VAs)...',
        'Computando taxas de assiduidade e presenças...',
        'Calculando correlações estatísticas entre frequência e aproveitamento...',
        'Mapeando estudantes em situação crítica de risco pedagógico...',
        'Estruturando planos de intervenção acadêmica com o Google Gemini...',
        'Sugerindo ferramentas e tecnologias educacionais sob medida para o docente...',
        'Refinando relatório final em Português do Brasil...'
    ];
    
    const [msgIndex, setMsgIndex] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => (prev + 1) % messages.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);
    
    return <span>{messages[msgIndex]}</span>;
}

function MarkdownRenderer({ text }) {
    if (!text) return null;
    
    const lines = text.split('\n');
    return (
        <div className="space-y-4">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                
                // Tratar títulos
                if (trimmed.startsWith('###')) {
                    return (
                        <h4 key={idx} className="text-sm font-extrabold text-indigo-700 mt-5 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-600" />
                            {trimmed.replace('###', '').replace(/[\*#]/g, '').trim()}
                        </h4>
                    );
                }
                if (trimmed.startsWith('##')) {
                    return (
                        <h3 key={idx} className="text-base font-bold text-text-primary mt-6 mb-3 border-b border-border-subtle pb-1">
                            {trimmed.replace('##', '').replace(/[\*#]/g, '').trim()}
                        </h3>
                    );
                }
                if (trimmed.startsWith('#')) {
                    return (
                        <h2 key={idx} className="text-lg font-extrabold text-indigo-800 mt-6 mb-4 border-l-4 border-indigo-600 pl-3">
                            {trimmed.replace('#', '').replace(/[\*#]/g, '').trim()}
                        </h2>
                    );
                }
                
                // Tratar listas
                if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
                    const cleanText = trimmed.substring(1).trim();
                    return (
                        <li key={idx} className="ml-5 list-disc text-xs leading-6 text-text-secondary">
                            {parseBold(cleanText)}
                        </li>
                    );
                }
                
                // Tratar numeradas
                const matchNumber = trimmed.match(/^(\d+)\.\s(.*)/);
                if (matchNumber) {
                    return (
                        <div key={idx} className="ml-2 text-xs leading-6 text-text-secondary my-1">
                            <span className="font-bold text-indigo-600">{matchNumber[1]}. </span>
                            {parseBold(matchNumber[2])}
                        </div>
                    );
                }
                
                // Parágrafos vazios ou normais
                if (trimmed) {
                    return (
                        <p key={idx} className="text-xs leading-6 text-text-secondary">
                            {parseBold(trimmed)}
                        </p>
                    );
                }
                return <div key={idx} className="h-1" />;
            })}
        </div>
    );
}

function parseBold(text) {
    const parts = text.split('**');
    return parts.map((part, index) => 
        index % 2 === 1 ? <strong key={index} className="font-extrabold text-text-primary">{part}</strong> : part
    );
}
