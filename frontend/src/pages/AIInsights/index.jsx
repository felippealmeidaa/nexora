import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Database, FileSpreadsheet, Loader2, MessageSquare, Send, Sparkles } from 'lucide-react';

import api from '@/services/api';
import { useDataMode } from '@/contexts/DataModeContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';

const SOURCE_OPTIONS = [
    {
        value: 'live',
        label: 'Dados em tempo real',
        description: 'Usa somente os dados atuais do Lyceum.',
        icon: Database,
    },
    {
        value: 'historical',
        label: 'Planilhas',
        description: 'Usa somente a base histórica para padrões e treinamento.',
        icon: FileSpreadsheet,
    },
    {
        value: 'both',
        label: 'Ambos',
        description: 'Cruza tempo real com padrões das planilhas históricas.',
        icon: Sparkles,
    },
];

const QUICK_QUESTIONS = [
    'Quais alunos exigem intervenção mais urgente neste momento?',
    'Quais padrões históricos ajudam a explicar o risco atual das turmas?',
    'Como posso agir nas turmas com maior chance de queda em nota ou frequência?',
    'Resuma os principais comportamentos de risco detectados na base ativa.',
];

function getDefaultSource(dataMode) {
    return dataMode === 'historical' ? 'historical' : 'live';
}

export function AIInsightsPage() {
    const { dataMode } = useDataMode();
    const [source, setSource] = useState(() => getDefaultSource(dataMode));
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Posso conversar usando dados em tempo real do Lyceum, planilhas históricas ou ambos. Escolha a base de conhecimento e faça sua pergunta.',
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const chatScrollRef = useRef(null);

    useEffect(() => {
        setSource(getDefaultSource(dataMode));
    }, [dataMode]);

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTo({
                top: chatScrollRef.current.scrollHeight,
                behavior: messages.length > 1 ? 'smooth' : 'auto',
            });
        }
    }, [messages, loading]);

    const selectedSourceMeta = useMemo(() => (
        SOURCE_OPTIONS.find((item) => item.value === source) || SOURCE_OPTIONS[0]
    ), [source]);

    const sendMessage = async (messageText) => {
        const nextMessage = String(messageText || input || '').trim();
        if (!nextMessage || loading) return;

        const nextHistory = [
            ...messages,
            { role: 'user', content: nextMessage },
        ];

        setMessages(nextHistory);
        setInput('');
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/analytics/assistant-chat', {
                message: nextMessage,
                source,
                history: nextHistory.map((item) => ({ role: item.role, content: item.content })),
            });

            setMessages((previous) => [
                ...previous,
                {
                    role: 'assistant',
                    content: response.data?.response || 'Não foi possível gerar resposta.',
                },
            ]);
        } catch (requestError) {
            console.error('Erro no Chat IA', requestError);
            const detail = requestError.response?.data?.detail || 'Não foi possível conversar com a IA no momento.';
            setError(detail);
            setMessages((previous) => [
                ...previous,
                {
                    role: 'assistant',
                    content: `Não consegui concluir a análise agora. Motivo: ${detail}`,
                },
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {error ? (
                <div className="rounded-[22px] border border-danger/20 bg-danger/8 px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}

            <Card>
                <CardHeader
                    title="Base de conhecimento da IA"
                    subtitle="Escolha se a resposta deve usar o Lyceum, as planilhas históricas ou a combinação das duas."
                    icon={MessageSquare}
                    action={<Badge variant="info">{selectedSourceMeta.label}</Badge>}
                />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {SOURCE_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = source === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setSource(option.value)}
                                className={[
                                    'rounded-[22px] border px-4 py-4 text-left transition',
                                    active
                                        ? 'border-accent-blue/35 bg-accent-blue/10 shadow-soft'
                                        : 'border-border-subtle bg-bg-secondary/45 hover:border-border-hover hover:bg-bg-card',
                                ].join(' ')}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-accent-blue shadow-sm">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-text-primary">{option.label}</p>
                                        <p className="mt-1 text-sm text-text-secondary">{option.description}</p>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
                <Card>
                    <CardHeader
                        title="Como a IA vai responder"
                        subtitle="A base histórica é usada como referência de padrões e treinamento para apoiar a leitura do presente."
                        icon={Bot}
                    />

                    <div className="space-y-3 text-sm text-text-secondary">
                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4">
                            <p className="font-semibold text-text-primary">Dados em tempo real</p>
                            <p className="mt-1">Responde com foco no retrato atual das turmas, alunos, notas e frequência extraídos do Lyceum.</p>
                        </div>
                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4">
                            <p className="font-semibold text-text-primary">Planilhas históricas</p>
                            <p className="mt-1">Usa a base antiga para encontrar padrões, comportamentos e referências que ajudam a treinar as previsões.</p>
                        </div>
                        <div className="rounded-[22px] border border-border-subtle bg-bg-secondary/45 px-4 py-4">
                            <p className="font-semibold text-text-primary">Ambos</p>
                            <p className="mt-1">Cruza o presente com o histórico para justificar melhor alertas, tendências e intervenções pedagógicas.</p>
                        </div>
                    </div>

                    <div className="mt-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Sugestões rápidas</p>
                        <div className="mt-3 grid gap-2">
                            {QUICK_QUESTIONS.map((question) => (
                                <button
                                    key={question}
                                    type="button"
                                    onClick={() => sendMessage(question)}
                                    className="rounded-2xl border border-border-subtle bg-bg-card px-4 py-3 text-left text-sm text-text-secondary transition hover:border-accent-blue/20 hover:text-text-primary"
                                >
                                    {question}
                                </button>
                            ))}
                        </div>
                    </div>
                </Card>

                <Card>
                    <CardHeader
                        title="Chat IA"
                        subtitle="Pergunte livremente. A resposta usa conhecimento geral da IA mais o contexto acadêmico selecionado."
                        icon={Sparkles}
                        action={<Badge variant="success">{selectedSourceMeta.label}</Badge>}
                    />

                    <div className="flex min-h-0 flex-1 flex-col">
                        <div
                            ref={chatScrollRef}
                            className="h-[400px] space-y-4 overflow-y-auto rounded-[24px] border border-border-subtle bg-bg-secondary/30 p-4 sm:h-[450px] xl:h-[500px]"
                        >
                            {messages.map((message, index) => (
                                <div
                                    key={`${message.role}-${index}`}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={[
                                            'max-w-[88%] rounded-[24px] border px-4 py-3 text-sm leading-relaxed',
                                            message.role === 'user'
                                                ? 'border-accent-blue/20 bg-accent-blue text-white'
                                                : 'border-border-subtle bg-white text-text-primary',
                                        ].join(' ')}
                                    >
                                        {message.role === 'user' ? (
                                            <div className="whitespace-pre-wrap">{message.content}</div>
                                        ) : (
                                            <MarkdownRenderer text={message.content} />
                                        )}
                                    </div>
                                </div>
                            ))}

                            {loading ? (
                                <div className="flex justify-start">
                                    <div className="flex items-center gap-2 rounded-[24px] border border-border-subtle bg-white px-4 py-3 text-sm text-text-secondary">
                                        <Loader2 className="h-4 w-4 animate-spin text-accent-blue" />
                                        Analisando a base selecionada...
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                sendMessage();
                            }}
                            className="mt-4 flex flex-col gap-3 sm:flex-row"
                        >
                            <input
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                placeholder="Pergunte sobre alunos, turmas, previsões, padrões ou intervenções..."
                                className="h-12 flex-1 rounded-2xl border border-border-subtle bg-bg-card px-4 text-sm text-text-primary outline-none"
                                disabled={loading}
                            />
                            <Button type="submit" icon={Send} disabled={!input.trim() || loading}>
                                Enviar
                            </Button>
                        </form>
                    </div>
                </Card>
            </div>
        </div>
    );
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
