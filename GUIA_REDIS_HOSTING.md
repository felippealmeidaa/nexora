# Guia de Redis e Hosting da NEXORA

## 1. Redis

O sistema agora funciona de dois jeitos:

- Sem `REDIS_URL`: usa cache local em memória.
- Com `REDIS_URL`: usa Redis para acelerar respostas e compartilhar cache entre processos.

### Exemplo de configuração no `.env`

```env
REDIS_URL=redis://localhost:6379/0
CACHE_NAMESPACE=nexora
CACHE_DEFAULT_TTL_SECONDS=900
REDIS_SOCKET_TIMEOUT_SECONDS=0.4
REDIS_RETRY_COOLDOWN_SECONDS=30
```

### Teste local com Docker

Se você tiver Docker:

```bash
docker run -d --name nexora-redis -p 6379:6379 redis:7-alpine
```

Depois disso, basta preencher:

```env
REDIS_URL=redis://localhost:6379/0
```

## 2. Backend em rede local

Os scripts em `scratch/` já foram ajustados para aceitar conexões fora do `localhost`.

### Rodar normalmente

```powershell
.\scratch\run_backend.cmd
```

### Rodar em host/porta específicos

```powershell
$env:BACKEND_HOST="0.0.0.0"
$env:BACKEND_PORT="8000"
.\scratch\run_backend.cmd
```

## 3. Frontend em rede local

O Vite agora já sobe com `0.0.0.0`.

```powershell
cd frontend
npm run dev
```

Depois disso, acesse pelo IP da máquina:

```text
http://SEU-IP-LOCAL:5173
```

Exemplo:

```text
http://192.168.0.10:5173
```

## 4. CORS

No backend, ajuste `CORS_ALLOWED_ORIGINS` no `.env` para incluir o endereço real do frontend.

Exemplo:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.0.10:5173,https://nexora.seudominio.com
```

## 5. Hosting simples para apresentação

### Opção A: notebook na mesma rede Wi‑Fi

1. Rodar backend:

```powershell
.\scratch\run_backend.cmd
```

2. Rodar frontend:

```powershell
cd frontend
npm run dev
```

3. Descobrir o IP local do notebook:

```powershell
ipconfig
```

4. Gerar QR Code com:

```text
http://SEU-IP-LOCAL:5173
```

Essa é a forma mais rápida para demonstração interna.

### Opção B: deploy real

Separação recomendada:

- Frontend: Vercel, Netlify ou servidor Nginx estático.
- Backend FastAPI: Render, Railway, VPS Linux ou Docker.
- Banco: PostgreSQL gerenciado.
- Cache: Redis gerenciado.

## 6. Produção

Para produção, recomenda-se:

- `SESSION_COOKIE_SECURE=true`
- domínio HTTPS real
- PostgreSQL real
- Redis real
- `CORS_ALLOWED_ORIGINS` apenas com domínios válidos
- backend servido por `uvicorn` atrás de proxy reverso (Nginx/Caddy) ou plataforma gerenciada

## 7. Observação importante

Mesmo sem Redis, o sistema continua funcionando com cache local. O Redis melhora especialmente:

- análises acadêmicas
- resumo do modo em tempo real
- catálogo de turmas/cursos/professores
- cenários com mais de um processo/instância
