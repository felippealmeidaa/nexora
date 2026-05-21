# NEXORA / SIMA

Plataforma acadêmica institucional para monitoramento, sincronização, análise histórica e apoio à decisão para aluno, professor, coordenação e pró-reitoria.

## Stack

- Backend: FastAPI, SQLAlchemy, SQLite, Selenium, scikit-learn, Gemini
- Frontend: React, Vite, Tailwind, Framer Motion, Recharts
- Migrações: Alembic

## Módulos principais

- autenticação e autorização por papel
- sincronização do portal Lyceum
- dashboard do aluno
- dashboard e escopo docente
- upload de planilhas históricas
- central analítica
- exportação em PDF, CSV, XLSX e JSON

## Perfis

- `student`
- `professor`
- `coordinator`
- `admin` na API, exibido como `proreitor` no frontend
- `viewer`

## Segurança aplicada nesta versão

- `SECRET_KEY` removida do código-fonte e movida para ambiente
- credenciais do Lyceum agora são armazenadas criptografadas
- bootstrap demo e criação de admin padrão desativados por default
- `CORS` configurável por origem explícita
- RBAC reforçado em alunos, cursos, notas e frequência
- upload histórico com validação de extensão, tamanho e limite de registros
- base de migrações com Alembic adicionada

## Configuração

Copie o exemplo:

```powershell
copy .env.example .env
```

Edite o `.env` e configure no mínimo:

```env
SECRET_KEY=defina-um-segredo-forte
GEMINI_API_KEY=sua_chave_se_for_usar_ia
DATABASE_URL=sqlite:///./academico.db
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Migrações

O projeto agora usa Alembic como fluxo oficial.

Criar uma revisão:

```powershell
alembic revision --autogenerate -m "descricao"
```

Aplicar migrações:

```powershell
alembic upgrade head
```

Observação:

- `AUTO_CREATE_SCHEMA=false` é o padrão recomendado
- em ambiente local antigo, só use `AUTO_CREATE_SCHEMA=true` de forma temporária, quando souber exatamente o que está fazendo

## Executando o backend

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Executando o frontend

```powershell
cd "C:\Users\guica\.gemini\antigravity\scratch\SIMA-mainn\SIMA-main\frontend"
npm run dev
```

## URLs

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`
- Swagger: `http://127.0.0.1:8000/docs`

## Bootstrap demo

O modo demo ficou desativado por padrão.

Só habilite se quiser subir um ambiente de demonstração:

```env
ENABLE_DEMO_BOOTSTRAP=true
SEED_EMPTY_DATABASE=true
```

Para criar um admin inicial automaticamente:

```env
CREATE_DEFAULT_ADMIN=true
DEFAULT_ADMIN_PASSWORD=defina-uma-senha-forte
```

## Upload histórico

Restrições atuais:

- extensões: `csv`, `xls`, `xlsx`, `txt`, `pdf`
- tamanho máximo controlado por `MAX_UPLOAD_BYTES`
- quantidade máxima de registros controlada por `MAX_HISTORICAL_RECORDS_PER_FILE`
- fallback de IA controlado por `ENABLE_GEMINI_UPLOAD_FALLBACK`

## Scraping Lyceum

Comportamento atual:

- usa Selenium
- tenta senha explícita salva pelo aluno
- fallback por CPF foi desativado por padrão

Se quiser reabilitar o fallback por CPF em ambiente controlado:

```env
ALLOW_LYCEUM_CPF_PASSWORD_FALLBACK=true
```

## Estrutura

```text
app/
  config.py
  database.py
  main.py
  models/
  routers/
  schemas/
  security/
  services/
  utils/
frontend/
  src/
seed/
tests/
alembic/
```

## Documentação técnica completa

Leia:

- [DOCUMENTACAO_TECNICA.md](./DOCUMENTACAO_TECNICA.md)

## Próximos passos recomendados

- migrar SQLite para PostgreSQL em ambiente compartilhado
- mover autenticação do frontend para cookie HttpOnly quando houver tempo de refatoração
- ampliar testes automatizados com banco isolado
- quebrar serviços e páginas monolíticas da análise histórica
