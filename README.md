# NEXORA

Plataforma acadêmica para monitoramento institucional com duas fontes de dados:

- `dados em tempo real`: snapshot extraído do portal docente do Lyceum
- `planilhas históricas`: base usada para treinamento, padrões e previsões

## Estrutura

- `app/`: backend FastAPI
- `frontend/`: frontend React + Vite
- `alembic/`: migrações
- `tests/`: testes automatizados
- `scratch/`: utilitários locais de operação

## Perfis

- `professor`: autentica com login do Lyceum e executa o scraper
- `coordinator`: autentica com código previamente aprovado pelo admin
- `admin`: visão institucional completa e gestão de aprovações de coordenadores

## Segurança

- cookies de sessão + refresh rotativo
- credenciais do Lyceum criptografadas em repouso
- limitação de tentativas de login
- chaves locais persistidas em `.nexora-runtime/` para desenvolvimento
- em produção, `SECRET_KEY` e `LYCEUM_CREDENTIALS_KEY` devem vir do ambiente

## Configuração

Copie o arquivo de exemplo:

```powershell
copy .env.example .env
```

Campos mais importantes:

```env
ENVIRONMENT=development
DATABASE_URL=sqlite:///./academico.db
SECRET_KEY=defina-um-segredo-forte-em-producao
LYCEUM_CREDENTIALS_KEY=defina-uma-chave-separada-em-producao
SESSION_COOKIE_SECURE=false
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Observações:

- em desenvolvimento, se `SECRET_KEY` e `LYCEUM_CREDENTIALS_KEY` não forem definidas, o sistema cria valores persistidos em `.nexora-runtime/`
- em produção, o backend bloqueia a inicialização se essas chaves não vierem do ambiente
- `AUTO_CREATE_SCHEMA`, `SEED_EMPTY_DATABASE`, `CREATE_DEFAULT_ADMIN` e `ENABLE_DEMO_BOOTSTRAP` não devem ficar ligados em produção

## Backend

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\scratch\run_backend.cmd
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Endereços locais

- frontend: `http://localhost:5173`
- backend: `http://127.0.0.1:8000`
- docs: `http://127.0.0.1:8000/docs`

## Fluxo do Lyceum

- o cadastro de professor valida login e senha diretamente no portal docente do Lyceum
- após a aprovação, o login no NEXORA passa a usar a senha do sistema
- a senha do Lyceum fica salva separadamente para futuras sincronizações do scraper
- coordenador e admin não executam scraper

## Redis

O cache Redis é opcional:

```env
REDIS_URL=redis://localhost:6379/0
CACHE_NAMESPACE=nexora
```

Se `REDIS_URL` não estiver preenchida, a aplicação usa cache local em memória.

## Deploy recomendado

Arquitetura sugerida para este momento:

- `frontend`: Cloudflare Pages
- `proxy /api`: Cloudflare Pages Functions
- `backend + scraper + SQLite`: sua própria máquina com Cloudflare Tunnel

Arquivos de apoio já incluídos no repositório:

- [GUIA_DEPLOY_CLOUDFLARE_TUNNEL.md](./GUIA_DEPLOY_CLOUDFLARE_TUNNEL.md)
- [frontend/.env.example](./frontend/.env.example)
- [deploy/cloudflare/.env.tunnel.example](./deploy/cloudflare/.env.tunnel.example)
- [deploy/cloudflare/start_quick_tunnel.ps1](./deploy/cloudflare/start_quick_tunnel.ps1)
- [deploy/cloudflare/cloudflared-config.example.yml](./deploy/cloudflare/cloudflared-config.example.yml)

Observação importante:

- o frontend continua chamando `/api`
- no Cloudflare Pages, a função `frontend/functions/api/[[path]].js` encaminha essas chamadas para o backend usando `API_ORIGIN`
- isso evita quebrar a autenticação baseada em cookies quando o frontend sair do localhost

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

## Documentação complementar

- [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md)
- [GUIA_REDIS_HOSTING.md](./GUIA_REDIS_HOSTING.md)
