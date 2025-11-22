#!/usr/bin/env bash
set -euo pipefail

# LadyManager dev strict runner
# - Frontend en 3000 (libera procesos en conflicto si es necesario)
# - Backend en 8000 (si está ocupado, falla y avisa; NO usa puertos alternativos)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
FRONT_DIR="$ROOT_DIR/frontend"
BACK_DIR="$ROOT_DIR/backend"

log() { echo "[dev-strict] $*"; }

# 1) Asegurar puerto 3000 libre (Frontend)
if lsof -i :3000 >/dev/null 2>&1; then
  log "Puerto 3000 ocupado. Liberando procesos..."
  lsof -i :3000 | awk 'NR>1 {print $2}' | xargs -r -n1 kill -9 || true
  sleep 0.5
fi

# 2) Validar puerto 8000 (Backend) NO se auto-liberará
if lsof -i :8000 >/dev/null 2>&1; then
  log "ERROR: puerto 8000 ocupado. Libera el proceso en conflicto y reintenta."
  exit 1
fi

# 3) Backend (uvicorn en 127.0.0.1:8000)
(
  cd "$BACK_DIR"
  if [ ! -d "venv" ]; then
    log "Creando venv e instalando dependencias del backend..."
    python3 -m venv venv
    # shellcheck disable=SC1091
    source venv/bin/activate
    pip install -r requirements.txt
  else
    # shellcheck disable=SC1091
    source venv/bin/activate
  fi
  log "Iniciando backend en 127.0.0.1:8000 (uvicorn)..."
  uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
  echo $! > "$ROOT_DIR/.dev-backend.pid"
)

sleep 1
if ! lsof -i :8000 >/dev/null 2>&1; then
  log "ERROR: backend no inició en 8000. Revisa logs y dependencias."
  exit 1
fi

# 4) Frontend (Next.js en 3000)
(
  cd "$FRONT_DIR"
  log "Iniciando frontend en http://localhost:3000 ..."
  PORT=3000 npm run dev
)

# Nota: Cierra manualmente el frontend (Ctrl+C). Para detener el backend:
#   if [ -f .dev-backend.pid ]; then kill "$(cat .dev-backend.pid)"; fi