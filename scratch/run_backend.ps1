$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$python = 'C:\Users\felip\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$sitePackages = Join-Path $repoRoot '.venv\Lib\site-packages'
$logDir = Join-Path $repoRoot 'backend\logs'
$stdoutLog = Join-Path $logDir 'uvicorn.out.log'
$stderrLog = Join-Path $logDir 'uvicorn.err.log'
$backendHost = if ($env:BACKEND_HOST) { $env:BACKEND_HOST } else { '0.0.0.0' }
$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { '8000' }

Set-Location $repoRoot
$env:PYTHONPATH = $sitePackages

if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

Write-Host "[nexora] Iniciando backend em $backendHost:$backendPort com logs em backend/logs"
& $python -c "import os, sys; sys.path.insert(0, r'$sitePackages'); sys.path.insert(0, r'$repoRoot'); import uvicorn; uvicorn.run('app.main:app', host=os.environ.get('BACKEND_HOST', '0.0.0.0'), port=int(os.environ.get('BACKEND_PORT', '8000')))" 1>> $stdoutLog 2>> $stderrLog
