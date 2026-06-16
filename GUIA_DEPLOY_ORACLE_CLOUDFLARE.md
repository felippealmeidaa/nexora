# GUIA DE DEPLOY - ORACLE CLOUD + CLOUDFLARE PAGES

Este guia prepara a arquitetura recomendada para a NEXORA:

- `frontend`: Cloudflare Pages
- `proxy /api`: Cloudflare Pages Functions
- `backend + scraper + SQLite`: Oracle Cloud Always Free

## 1. Estrutura final

```text
Navegador
  -> Cloudflare Pages
     -> /api (proxy por Pages Functions)
        -> Oracle VM (Nginx -> Uvicorn/FastAPI)
           -> SQLite + Selenium/Chromium
```

### Por que este modelo foi escolhido

- mantem o frontend rapido e facil de atualizar por `git push`
- preserva o SQLite e o scraper numa VM real
- evita problemas de autenticacao no navegador, porque o frontend continua chamando `/api` no mesmo dominio do Pages

## 2. Ajustes ja preparados no projeto

- `frontend/src/services/api.js`: aceita `VITE_API_BASE_URL`, mas funciona por padrao com `/api`
- `frontend/functions/api/[[path]].js`: encaminha as chamadas `/api/*` para a Oracle usando a variavel `API_ORIGIN`
- `frontend/public/_redirects`: garante fallback de SPA no Cloudflare Pages
- `deploy/oracle/bootstrap_ubuntu.sh`: instala dependencias base da VM
- `deploy/oracle/nexora-api.service`: service de exemplo para systemd
- `deploy/oracle/nginx-nexora.conf`: proxy reverso de exemplo
- `deploy/oracle/.env.production.example`: exemplo de ambiente de producao

## 3. Preparar a Oracle Cloud

### 3.1 Criar a VM

Sugestao:

- imagem Ubuntu LTS
- instancia Always Free
- liberar pelo menos a porta `80` na VCN / Security List

### 3.2 Conectar por SSH

Depois de criar a VM, entre por SSH e rode:

```bash
sudo mkdir -p /srv/nexora
sudo chown -R $USER:$USER /srv/nexora
cd /srv/nexora
git clone SEU_REPOSITORIO app
cd app
bash deploy/oracle/bootstrap_ubuntu.sh
```

### 3.3 Configurar Python e dependencias

```bash
cd /srv/nexora/app
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.4 Criar o arquivo de ambiente

```bash
cp deploy/oracle/.env.production.example .env.production
nano .env.production
```

Campos mais importantes:

- `SECRET_KEY`
- `LYCEUM_CREDENTIALS_KEY`
- `DATABASE_URL=sqlite:////srv/nexora/storage/academico.db`
- `CORS_ALLOWED_ORIGINS=https://SEU-PROJETO.pages.dev`
- `SESSION_COOKIE_SECURE=true`

### 3.5 Rodar migracoes

```bash
. .venv/bin/activate
alembic upgrade head
```

### 3.6 Subir o backend com systemd

```bash
sudo cp deploy/oracle/nexora-api.service /etc/systemd/system/nexora-api.service
sudo nano /etc/systemd/system/nexora-api.service
```

Revise pelo menos:

- `User`
- `Group`
- `WorkingDirectory`
- `EnvironmentFile`
- `ExecStart`

Depois:

```bash
sudo systemctl daemon-reload
sudo systemctl enable nexora-api
sudo systemctl start nexora-api
sudo systemctl status nexora-api
```

### 3.7 Configurar o Nginx

```bash
sudo cp deploy/oracle/nginx-nexora.conf /etc/nginx/sites-available/nexora
sudo ln -s /etc/nginx/sites-available/nexora /etc/nginx/sites-enabled/nexora
sudo nginx -t
sudo systemctl reload nginx
```

Agora a API deve responder no IP publico da VM pela porta `80`.

Teste:

```bash
curl http://SEU_IP_PUBLICO/health
```

## 4. Preparar o Cloudflare Pages

### 4.1 Criar o projeto

No Cloudflare Pages:

- conecte o repositorio Git
- selecione a pasta `frontend`

Configuracao sugerida:

- `Build command`: `npm ci && npm run build`
- `Build output directory`: `dist`

### 4.2 Variavel de ambiente obrigatoria

No projeto do Cloudflare Pages, configure:

```text
API_ORIGIN=http://SEU_IP_PUBLICO
```

O proxy da pasta `frontend/functions/api/` vai encaminhar automaticamente:

- `/api/auth/login`
- `/api/live-data/...`
- `/api/historical-data/...`

para:

```text
http://SEU_IP_PUBLICO/api/auth/login
http://SEU_IP_PUBLICO/api/live-data/...
http://SEU_IP_PUBLICO/api/historical-data/...
```

### 4.3 Deploy

Depois de salvar, o Cloudflare Pages vai gerar a URL publica, por exemplo:

```text
https://nexora.pages.dev
```

## 5. Como atualizar depois do deploy

### Frontend

Depois que o Pages estiver conectado ao Git, basta:

```bash
git add .
git commit -m "Atualiza frontend"
git push
```

O Cloudflare Pages redeploya automaticamente.

### Backend na Oracle

Na VM:

```bash
bash /srv/nexora/app/deploy/oracle/update_backend.sh
```

## 6. Observacoes importantes

### Scraper na Oracle

O scraper foi preparado para procurar Chrome/Chromium e `chromedriver` tambem em Linux.  
Se o navegador nao subir, confira:

```bash
which chromium
which chromium-browser
which google-chrome
which chromedriver
```

### HTTPS

Para demonstracao inicial, o fluxo pode funcionar com:

- frontend em `https://...pages.dev`
- backend em `http://IP_PUBLICO`

Mas, para uso mais serio, o ideal e colocar HTTPS tambem no backend usando dominio proprio e proxy reverso.

### Redis

Nao e obrigatorio para o primeiro deploy.  
Sem `REDIS_URL`, a NEXORA usa cache local em memoria.
