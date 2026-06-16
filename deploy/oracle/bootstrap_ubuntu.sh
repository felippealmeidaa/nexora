#!/usr/bin/env bash
set -euo pipefail

echo "[nexora] Atualizando pacotes do sistema..."
sudo apt-get update

echo "[nexora] Instalando dependencias base..."
sudo apt-get install -y \
  python3 \
  python3-venv \
  python3-pip \
  git \
  nginx \
  curl \
  unzip \
  ca-certificates

echo "[nexora] Instalando navegador para o scraper..."
if apt-cache show chromium >/dev/null 2>&1; then
  sudo apt-get install -y chromium chromium-driver
elif apt-cache show chromium-browser >/dev/null 2>&1; then
  sudo apt-get install -y chromium-browser chromium-chromedriver
else
  echo "[nexora] Nenhum pacote Chromium encontrado neste repositorio. Instale manualmente Google Chrome + chromedriver."
fi

echo "[nexora] Preparando diretórios recomendados..."
sudo mkdir -p /srv/nexora/storage
sudo chown -R "$USER":"$USER" /srv/nexora

echo "[nexora] Bootstrap concluido."
