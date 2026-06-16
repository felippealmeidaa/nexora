@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"
set "PYTHON_EXE=C:\Users\felip\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "SITE_PACKAGES=%REPO_ROOT%\.venv\Lib\site-packages"
if "%BACKEND_HOST%"=="" set "BACKEND_HOST=0.0.0.0"
if "%BACKEND_PORT%"=="" set "BACKEND_PORT=8000"

cd /d "%REPO_ROOT%"
set "PYTHONPATH=%SITE_PACKAGES%"
set "PYTHONUNBUFFERED=1"

echo [nexora] Iniciando backend com logs no terminal em %BACKEND_HOST%:%BACKEND_PORT%...
"%PYTHON_EXE%" -c "import os, sys; sys.path.insert(0, r'%SITE_PACKAGES%'); sys.path.insert(0, r'%REPO_ROOT%'); import uvicorn; uvicorn.run('app.main:app', host=os.environ.get('BACKEND_HOST', '0.0.0.0'), port=int(os.environ.get('BACKEND_PORT', '8000')), log_level='info')"
