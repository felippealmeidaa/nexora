@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fI"
set "PYTHON_EXE=C:\Users\felip\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
set "SITE_PACKAGES=%REPO_ROOT%\.venv\Lib\site-packages"
set "LOG_DIR=%REPO_ROOT%\backend\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%REPO_ROOT%"
set "PYTHONPATH=%SITE_PACKAGES%"
set "PYTHONUNBUFFERED=1"

"%PYTHON_EXE%" -c "import sys; sys.path.insert(0, r'%SITE_PACKAGES%'); sys.path.insert(0, r'%REPO_ROOT%'); import uvicorn; uvicorn.run('app.main:app', host='127.0.0.1', port=8000, log_level='info')" 1>> "%LOG_DIR%\uvicorn.out.log" 2>> "%LOG_DIR%\uvicorn.err.log"
