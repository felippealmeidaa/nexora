# GUIA DE DEPLOY - CLOUDFLARE PAGES + CLOUDFLARE TUNNEL

Este guia prepara a arquitetura gratuita mais simples para a NEXORA neste momento:

- `frontend`: Cloudflare Pages
- `proxy /api`: Cloudflare Pages Functions
- `backend + scraper + SQLite`: sua propria maquina Windows
- `exposicao publica do backend`: Cloudflare Tunnel

## 1. Estrutura final

```text
Navegador
  -> Cloudflare Pages
     -> /api (proxy por Pages Functions)
        -> Cloudflare Tunnel
           -> FastAPI local em 127.0.0.1:8000
              -> SQLite + Selenium/Chrome ou Edge
```

## 2. O que ja esta pronto no projeto

- `frontend/src/services/api.js`: funciona por padrao com `/api`
- `frontend/functions/api/[[path]].js`: encaminha `/api/*` para a origem definida em `API_ORIGIN`
- `frontend/public/_redirects`: fallback de SPA no Pages
- `scratch/run_backend.cmd`: sobe o backend local com logs
- `deploy/cloudflare/.env.tunnel.example`: exemplo de ambiente para uso com Tunnel
- `deploy/cloudflare/start_quick_tunnel.ps1`: sobe um Quick Tunnel para demo
- `deploy/cloudflare/cloudflared-config.example.yml`: modelo para Tunnel nomeado com dominio proprio

## 3. Como funciona essa estrategia

### Vantagens

- mantem o backend no ambiente onde o scraper ja funciona
- preserva o SQLite sem migracao agora
- evita refatoracao extra antes da apresentacao
- permite publicar o frontend com URL publica pelo Cloudflare Pages

### Limitacao importante

Enquanto o backend estiver rodando na sua maquina:

- sua maquina precisa ficar ligada
- o backend precisa continuar aberto
- o tunnel precisa continuar ativo

Para apresentacao e validacao isso costuma ser suficiente. Para uso 24/7 real, depois vale migrar para VPS ou host dedicado.

## 4. Preparar o backend local

### 4.1 Criar o ambiente

Na raiz do projeto:

```powershell
copy .env.example .env
```

Ou use o exemplo preparado para Tunnel:

```powershell
copy deploy\cloudflare\.env.tunnel.example .env
```

Campos mais importantes:

```env
ENVIRONMENT=production
DATABASE_URL=sqlite:///./academico.db
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
CORS_ALLOWED_ORIGINS=https://SEU-PROJETO.pages.dev
```

Observacao:

- `SECRET_KEY` e `LYCEUM_CREDENTIALS_KEY` devem ser fortes em producao
- `SESSION_COOKIE_SECURE=true` deve ficar ligado porque o navegador acessara o frontend por HTTPS

### 4.2 Subir o backend

```powershell
.\scratch\run_backend.cmd
```

Teste local:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/docs
```

## 5. Preparar o Cloudflare Pages

Segundo a documentacao oficial do Pages, o fluxo recomendado e conectar o repositorio GitHub ao projeto Pages e fazer o build da pasta do frontend: [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/).

### 5.1 Criar o projeto

No Cloudflare Pages:

- conecte o repositorio `felippealmeidaa/nexora`
- selecione a pasta `frontend`

Configuracao sugerida:

- `Build command`: `npm ci && npm run build`
- `Build output directory`: `dist`
- `Root directory`: `frontend`

### 5.2 Variavel de ambiente do Pages

Configure no projeto:

```text
API_ORIGIN=https://SEU-ENDERECO-DO-TUNNEL
```

Exemplo:

```text
API_ORIGIN=https://abc123.trycloudflare.com
```

O proxy da pasta `frontend/functions/api/` vai encaminhar automaticamente:

- `/api/auth/login`
- `/api/live-data/...`
- `/api/historical-data/...`

para:

```text
https://abc123.trycloudflare.com/api/auth/login
https://abc123.trycloudflare.com/api/live-data/...
https://abc123.trycloudflare.com/api/historical-data/...
```

## 6. Criar o Cloudflare Tunnel

Para teste rapido, a propria Cloudflare documenta o uso de Quick Tunnels publicos temporarios: [TryCloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/).

### 6.1 Instalar o cloudflared

No Windows, instale o `cloudflared` da forma que preferir:

- instalador oficial da Cloudflare
- ou `winget`, se disponivel na sua maquina

Depois confirme:

```powershell
cloudflared --version
```

### 6.2 Subir um Quick Tunnel para apresentacao

Com o backend ja rodando:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\cloudflare\start_quick_tunnel.ps1
```

O comando vai publicar algo como:

```text
https://abc123.trycloudflare.com
```

Copie essa URL e coloque em `API_ORIGIN` no Cloudflare Pages.

Depois disso, faca um novo deploy do Pages para o frontend passar a usar esse tunnel.

## 7. Fluxo pratico recomendado

### Primeira publicacao

1. subir backend com `.\scratch\run_backend.cmd`
2. subir o Quick Tunnel
3. copiar a URL publica do tunnel
4. colocar essa URL em `API_ORIGIN` no Cloudflare Pages
5. publicar o frontend
6. abrir a URL `pages.dev` e testar login

### Quando o tunnel mudar

Se voce reiniciar o tunnel e a URL mudar:

1. copie a nova URL
2. atualize `API_ORIGIN` no Pages
3. redeploy do frontend

## 8. Opcao estavel depois

Se no futuro voce tiver um dominio dentro do Cloudflare, pode trocar o Quick Tunnel por um Tunnel nomeado usando um hostname fixo, como:

```text
https://api.nexora.seudominio.com
```

O modelo de configuracao para isso esta em:

- `deploy/cloudflare/cloudflared-config.example.yml`

Nesse caso, `API_ORIGIN` deixa de mudar a cada reinicio.

## 9. Como atualizar depois do deploy

### Frontend

Depois que o Pages estiver conectado ao Git:

```powershell
git add .
git commit -m "Atualiza frontend"
git push
```

O Cloudflare Pages redeploya automaticamente.

### Backend

Basta manter sua maquina ligada e iniciar:

```powershell
.\scratch\run_backend.cmd
powershell -ExecutionPolicy Bypass -File .\deploy\cloudflare\start_quick_tunnel.ps1
```

## 10. Checklist final antes de apresentar

- backend responde em `http://127.0.0.1:8000/health`
- scraper funciona localmente
- tunnel mostra URL publica ativa
- `API_ORIGIN` no Pages aponta para a URL atual do tunnel
- frontend publicado abre normalmente
- login, dashboard e analises carregam sem erro
