#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/AI_Lapin}"
SERVICE_NAME="${SERVICE_NAME:-ai-lapin.service}"
REPO_URL="${REPO_URL:-https://github.com/vlas47/Lider.git}"
BRANCH="${BRANCH:-ai-lapin-prod}"

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Initializing git checkout"
  git -C "$APP_DIR" init
  git -C "$APP_DIR" remote add origin "$REPO_URL"
fi

old_rev=""
if git -C "$APP_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  old_rev="$(git -C "$APP_DIR" rev-parse HEAD)"
fi

log "Fetching $REPO_URL $BRANCH"
git -C "$APP_DIR" remote set-url origin "$REPO_URL"
git -C "$APP_DIR" fetch --prune origin "$BRANCH"
git -C "$APP_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
git -C "$APP_DIR" reset --hard "origin/$BRANCH"
git -C "$APP_DIR" clean -fd \
  -e .env \
  -e venv \
  -e .venv \
  -e profiles \
  -e .playwright-browsers \
  -e frontend/node_modules \
  -e frontend/dist \
  -e staticfiles \
  -e db.sqlite3

new_rev="$(git -C "$APP_DIR" rev-parse HEAD)"
if [[ "${FORCE_DEPLOY:-0}" != "1" && -n "$old_rev" && "$old_rev" == "$new_rev" ]]; then
  log "Already at $new_rev; nothing to deploy"
  exit 0
fi

if [[ ! -d "$APP_DIR/venv" ]]; then
  log "Creating Python virtual environment"
  python3 -m venv "$APP_DIR/venv"
fi

log "Installing Python dependencies"
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

log "Building React frontend"
if command -v npm >/dev/null 2>&1; then
  if ! (npm --prefix "$APP_DIR/frontend" ci --no-audit --no-fund && \
        npm --prefix "$APP_DIR/frontend" run build); then
    if [[ -f "$APP_DIR/frontend/dist/index.html" ]]; then
      log "npm build failed; using the existing verified frontend/dist"
    else
      exit 1
    fi
  fi
elif [[ ! -f "$APP_DIR/frontend/dist/index.html" ]]; then
  log "npm is required because frontend/dist is missing"
  exit 1
fi

log "Running Django checks"
"$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" check
"$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" migrate --noinput
"$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" collectstatic --noinput

log "Setting web asset permissions"
for asset_dir in "$APP_DIR/frontend/dist" "$APP_DIR/staticfiles"; do
  if [[ -d "$asset_dir" ]]; then
    chgrp -R www-data "$asset_dir"
    find "$asset_dir" -type d -exec chmod 0750 {} +
    find "$asset_dir" -type f -exec chmod 0640 {} +
  fi
done

log "Restarting $SERVICE_NAME"
sudo -n systemctl restart "$SERVICE_NAME"
systemctl is-active --quiet "$SERVICE_NAME"
for monitor_service in ai-lapin-profi-monitor.service ai-lapin-freelance-monitor.service; do
  if systemctl cat "$monitor_service" >/dev/null 2>&1; then
    log "Restarting $monitor_service"
    sudo -n systemctl restart "$monitor_service"
    systemctl is-active --quiet "$monitor_service"
  fi
done
for attempt in {1..30}; do
  if curl --fail --silent -H 'Host: liderscan.ru' \
    -H 'X-Forwarded-Proto: https' \
    --unix-socket /run/ai-lapin/gunicorn.sock \
    http://localhost/health/ >/dev/null 2>&1; then
    break
  fi
  if [[ $attempt -eq 30 ]]; then
    log "AI_Lapin socket health check failed"
    exit 1
  fi
  sleep 1
done

log "AI_Lapin deployed"
