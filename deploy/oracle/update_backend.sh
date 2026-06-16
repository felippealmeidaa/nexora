#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/nexora/app}"

cd "$APP_DIR"

git pull
. .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart nexora-api
sudo systemctl status nexora-api --no-pager
