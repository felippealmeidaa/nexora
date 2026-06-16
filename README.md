# NEXORA

Plataforma academica para monitoramento institucional com duas fontes de dados:

- `dados em tempo real`: snapshot extraido do portal docente do Lyceum
- `planilhas historicas`: base usada para treinamento, padroes e previsoes

## Estrutura

- `app/`: backend FastAPI
- `frontend/`: frontend React + Vite
- `alembic/`: migracoes
- `tests/`: testes automatizados
- `scratch/`: utilitarios locais de operacao

## Perfis

- `professor`: autentica com login do Lyceum e executa o scraper
- `coordinator`: autentica com codigo previamente aprovado pelo admin
- `admin`: visao institucional completa e gestao de aprovacoes de coordenadores

## Seguranca

- cookies de sessao + refresh rotativo
- credenciais do Lyceum criptografadas em repouso
- limitacao de tentativas de login
- chaves locais persistidas em `.nexora-runtime/` para desenvolvimento
- em producao, `SECRET_KEY` e `LYCEUM_CREDENTIALS_KEY` devem vir do ambiente

## Configuracao

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

Observacoes:

- em desenvolvimento, se `SECRET_KEY` e `LYCEUM_CREDENTIALS_KEY` nao forem definidas, o sistema cria valores persistidos em `.nexora-runtime/`
- em producao, o backend bloqueia a inicializacao se essas chaves nao vierem do ambiente
- `AUTO_CREATE_SCHEMA`, `SEED_EMPTY_DATABASE`, `CREATE_DEFAULT_ADMIN` e `ENABLE_DEMO_BOOTSTRAP` nao devem ficar ligados em producao

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

## Enderecos locais

- frontend: `http://localhost:5173`
- backend: `http://127.0.0.1:8000`
- docs: `http://127.0.0.1:8000/docs`

## Fluxo do Lyceum

- o cadastro de professor valida login e senha diretamente no portal docente do Lyceum
- apos a aprovacao, o login no NEXORA passa a usar a senha do sistema
- a senha do Lyceum fica salva separadamente para futuras sincronizacoes do scraper
- coordenador e admin nao executam scraper

## Redis

O cache Redis e opcional:

```env
REDIS_URL=redis://localhost:6379/0
CACHE_NAMESPACE=nexora
```

Se `REDIS_URL` nao estiver preenchida, a aplicacao usa cache local em memoria.

## Deploy recomendado

Arquitetura sugerida para este projeto:

- `frontend`: Cloudflare Pages
- `proxy /api`: Cloudflare Pages Functions
- `backend + scraper + SQLite`: Oracle Cloud Always Free

Arquivos de apoio ja incluidos no repositorio:

- [GUIA_DEPLOY_ORACLE_CLOUDFLARE.md](./GUIA_DEPLOY_ORACLE_CLOUDFLARE.md)
- [frontend/.env.example](./frontend/.env.example)
- [deploy/oracle/.env.production.example](./deploy/oracle/.env.production.example)
- [deploy/oracle/nexora-api.service](./deploy/oracle/nexora-api.service)
- [deploy/oracle/nginx-nexora.conf](./deploy/oracle/nginx-nexora.conf)
- [deploy/oracle/bootstrap_ubuntu.sh](./deploy/oracle/bootstrap_ubuntu.sh)

Observacao importante:

- o frontend continua chamando `/api`
- no Cloudflare Pages, a funcao `frontend/functions/api/[[path]].js` encaminha essas chamadas para a Oracle usando `API_ORIGIN`
- isso evita quebrar a autenticacao baseada em cookies quando o frontend sair do localhost

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
```

## Documentacao complementar

- [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md)
- [GUIA_REDIS_HOSTING.md](./GUIA_REDIS_HOSTING.md)
