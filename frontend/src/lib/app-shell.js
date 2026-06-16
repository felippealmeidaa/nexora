import {
    Activity,
    BrainCircuit,
    Database,
    FileSpreadsheet,
    LayoutDashboard,
    MessageSquare,
    ScrollText,
    Shield,
    UserCircle2,
} from 'lucide-react';

const ROLE_META = {
    admin: {
        label: 'Admin',
        area: 'Supervisão acadêmica ampliada',
        shortLabel: 'Admin',
        accent: 'from-accent-blue-dark via-accent-blue to-accent-purple',
        softAccent: 'from-accent-blue-dark/8 via-accent-blue/10 to-accent-purple/14',
        badge: 'bg-accent-blue-dark/10 text-accent-blue-dark border-accent-blue/15',
        dot: 'bg-accent-blue-dark',
        home: '/proreitor/dashboard',
    },
    viewer: {
        label: 'Institucional',
        area: 'Consulta executiva',
        shortLabel: 'Consulta',
        accent: 'from-accent-blue-dark via-accent-blue to-accent-purple',
        softAccent: 'from-accent-blue-dark/8 via-accent-blue/10 to-accent-purple/14',
        badge: 'bg-accent-blue-dark/10 text-accent-blue-dark border-accent-blue/15',
        dot: 'bg-accent-blue-dark',
        home: '/',
    },
    coordinator: {
        label: 'Coordenador',
        area: 'Gestão de curso',
        shortLabel: 'Coordenação',
        accent: 'from-accent-purple via-accent-purple-light to-accent-blue',
        softAccent: 'from-accent-purple/10 via-accent-purple-light/10 to-accent-blue/12',
        badge: 'bg-accent-purple/10 text-accent-purple border-accent-purple/15',
        dot: 'bg-accent-purple',
        home: '/coordinator/dashboard',
    },
    professor: {
        label: 'Professor',
        area: 'Acompanhamento de turmas',
        shortLabel: 'Docência',
        accent: 'from-accent-indigo via-accent-purple to-accent-blue',
        softAccent: 'from-accent-indigo/10 via-accent-purple/10 to-accent-blue/12',
        badge: 'bg-accent-indigo/10 text-accent-indigo border-accent-indigo/15',
        dot: 'bg-accent-indigo',
        home: '/professor/dashboard',
    },
};

function normalizeRole(role) {
    return String(role || 'viewer').toLowerCase();
}

export function getRoleMeta(role) {
    const normalizedRole = normalizeRole(role);
    return ROLE_META[normalizedRole] || ROLE_META.viewer;
}

export function getDefaultRoute(role) {
    return getRoleMeta(role).home;
}

export function getNavItems(role, dataMode = 'real') {
    const normalizedRole = normalizeRole(role);
    const isHistoricalMode = dataMode === 'historical';

    if (normalizedRole === 'admin') {
        return [
            { icon: Activity, label: 'Dashboard admin', description: 'Visão resumida do modo ativo', to: '/proreitor/dashboard' },
            ...(isHistoricalMode
                ? [
                    { icon: ScrollText, label: 'Subir planilhas', description: 'Envio e processamento dos arquivos históricos', to: '/proreitor/historical-upload' },
                    { icon: FileSpreadsheet, label: 'Histórico de planilhas', description: 'Arquivos processados e leituras consolidadas', to: '/proreitor/historical-data' },
                ]
                : [
                    { icon: Database, label: 'Dados', description: 'Turmas, alunos, notas e frequência do Lyceum', to: '/proreitor/live-data' },
                ]),
            { icon: BrainCircuit, label: 'Análises acadêmicas', description: 'Análises baseadas na fonte ativa de dados', to: '/proreitor/analysis-center' },
            { icon: MessageSquare, label: 'Chat IA', description: 'Assistente com acesso às bases acadêmicas do sistema', to: '/proreitor/ai-insights' },
            { icon: Shield, label: 'Coordenadores', description: 'Pré-aprovação de contas e cursos coordenados', to: '/proreitor/coordinators' },
            { icon: UserCircle2, label: 'Meu perfil', description: 'Dados administrativos da conta', to: '/proreitor/profile' },
        ];
    }

    if (normalizedRole === 'professor') {
        return [
            { icon: Activity, label: 'Dashboard docente', description: 'Visão resumida do modo ativo', to: '/professor/dashboard' },
            ...(isHistoricalMode
                ? [
                    { icon: ScrollText, label: 'Subir planilhas', description: 'Envio e processamento dos arquivos históricos', to: '/professor/historical-upload' },
                    { icon: FileSpreadsheet, label: 'Histórico de planilhas', description: 'Arquivos processados e leituras consolidadas', to: '/professor/historical-data' },
                ]
                : [
                    { icon: Database, label: 'Dados', description: 'Turmas, alunos, notas e frequência do Lyceum', to: '/professor/live-data' },
                ]),
            { icon: BrainCircuit, label: 'Análises acadêmicas', description: 'Análises baseadas na fonte ativa de dados', to: '/professor/analysis-center' },
            { icon: MessageSquare, label: 'Chat IA', description: 'Assistente com contexto do Lyceum, planilhas ou ambos', to: '/professor/ai-insights' },
            { icon: UserCircle2, label: 'Meu perfil', description: 'Credenciais, sincronização e dados da conta', to: '/professor/profile' },
        ];
    }

    if (normalizedRole === 'coordinator') {
        return [
            { icon: Shield, label: 'Dashboard docente', description: 'Visão resumida do modo ativo', to: '/coordinator/dashboard' },
            ...(isHistoricalMode
                ? [
                    { icon: ScrollText, label: 'Subir planilhas', description: 'Envio e processamento dos arquivos históricos', to: '/coordinator/historical-upload' },
                    { icon: FileSpreadsheet, label: 'Histórico de planilhas', description: 'Arquivos processados e leituras consolidadas', to: '/coordinator/historical-data' },
                ]
                : [
                    { icon: Database, label: 'Dados', description: 'Turmas do curso, alunos, notas e frequência', to: '/coordinator/live-data' },
                ]),
            { icon: BrainCircuit, label: 'Análises acadêmicas', description: 'Análises baseadas na fonte ativa de dados', to: '/coordinator/analysis-center' },
            { icon: MessageSquare, label: 'Chat IA', description: 'Assistente com acesso às bases do curso e aos padrões históricos', to: '/coordinator/ai-insights' },
            { icon: UserCircle2, label: 'Meu perfil', description: 'Credenciais e dados da conta', to: '/coordinator/profile' },
        ];
    }

    return [
        { icon: LayoutDashboard, label: 'Visão institucional', description: 'KPIs globais e mapa de risco', to: '/' },
    ];
}

export function getRoleRoutePrefix(role) {
    const normalizedRole = normalizeRole(role);
    if (normalizedRole === 'admin') return '/proreitor';
    if (normalizedRole === 'professor') return '/professor';
    if (normalizedRole === 'coordinator') return '/coordinator';
    return '';
}

export function buildRolePath(role, subpath = '') {
    const prefix = getRoleRoutePrefix(role);
    if (!prefix) return subpath || '/';
    const cleanSubpath = String(subpath || '').replace(/^\/+/, '');
    return cleanSubpath ? `${prefix}/${cleanSubpath}` : prefix;
}

export function isProfessorLikeRole(role) {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === 'professor' || normalizedRole === 'admin';
}

export function getInitials(name) {
    if (!name) return 'NX';

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'NX';
}

export function getPageMeta(pathname, role, dataMode = 'real') {
    const items = getNavItems(role, dataMode);
    const sortedItems = [...items].sort((left, right) => right.to.length - left.to.length);
    const match = sortedItems.find((item) => (
        item.to === '/'
            ? pathname === '/'
            : pathname === item.to || pathname.startsWith(`${item.to}/`)
    ));

    if (match) return match;

    return {
        label: 'Painel',
        description: getRoleMeta(role).area,
        icon: LayoutDashboard,
        to: getDefaultRoute(role),
    };
}
