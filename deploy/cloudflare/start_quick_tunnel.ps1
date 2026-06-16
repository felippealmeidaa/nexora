param(
    [string]$BackendUrl = "http://127.0.0.1:8000"
)

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Error "cloudflared nao encontrado. Instale o Cloudflare Tunnel antes de continuar."
    exit 1
}

Write-Host "[nexora] Iniciando Quick Tunnel para $BackendUrl" -ForegroundColor Cyan
Write-Host "[nexora] Copie a URL https://...trycloudflare.com exibida abaixo e use em API_ORIGIN no Cloudflare Pages." -ForegroundColor Yellow

& $cloudflared.Source tunnel --url $BackendUrl
