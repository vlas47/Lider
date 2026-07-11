#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/cloud_site}"
REPO_URL="${REPO_URL:-https://github.com/vlas47/Lider.git}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-cloud-site.service}"
LOCK_FILE="/run/lider-deploy.lock"

log() {
  printf '[%s] %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "Required command is missing: $1"
    exit 1
  fi
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Another deployment is already running."
  exit 0
fi

require_command git
require_command npm
require_command systemctl

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "$APP_DIR is not a git checkout."
  exit 1
fi

git_app() {
  git -c "safe.directory=$APP_DIR" "$@"
}

sync_deploy_units() {
  local changed=0

  if [[ -f "$APP_DIR/deploy/lider-deploy-main.sh" ]] && ! cmp -s "$APP_DIR/deploy/lider-deploy-main.sh" /usr/local/bin/lider-deploy-main.sh; then
    install -m 0755 "$APP_DIR/deploy/lider-deploy-main.sh" /usr/local/bin/lider-deploy-main.sh
    changed=1
  fi

  if [[ -f "$APP_DIR/deploy/lider-deploy.service" ]] && ! cmp -s "$APP_DIR/deploy/lider-deploy.service" /etc/systemd/system/lider-deploy.service; then
    install -m 0644 "$APP_DIR/deploy/lider-deploy.service" /etc/systemd/system/lider-deploy.service
    changed=1
  fi

  if [[ -f "$APP_DIR/deploy/lider-deploy.timer" ]] && ! cmp -s "$APP_DIR/deploy/lider-deploy.timer" /etc/systemd/system/lider-deploy.timer; then
    install -m 0644 "$APP_DIR/deploy/lider-deploy.timer" /etc/systemd/system/lider-deploy.timer
    changed=1
  fi

  if [[ "$changed" == "1" ]]; then
    systemctl daemon-reload
    systemctl enable --now lider-deploy.timer >/dev/null
  fi
}

cd "$APP_DIR"

if [[ "$(git_app remote get-url origin 2>/dev/null || true)" != "$REPO_URL" ]]; then
  git_app remote set-url origin "$REPO_URL"
fi

current_sha="$(git_app rev-parse HEAD)"

log "Fetching origin/$BRANCH"
git_app fetch origin "$BRANCH"
target_sha="$(git_app rev-parse "origin/$BRANCH")"

if [[ "${FORCE_DEPLOY:-0}" != "1" && "$current_sha" == "$target_sha" ]]; then
  log "Already deployed $target_sha"
  exit 0
fi

log "Updating $APP_DIR from $current_sha to $target_sha"
git_app checkout "$BRANCH"
git_app reset --hard "origin/$BRANCH"
git_app clean -fd \
  -e .env \
  -e venv \
  -e staticfiles \
  -e media \
  -e industrial_jobs \
  -e frontend/node_modules

sync_deploy_units

log "Building frontend for $target_sha"
(
  cd "$APP_DIR/frontend"
  npm ci
  npm run build
)

chown -R deploy:www-data "$APP_DIR"
find "$APP_DIR/venv/bin" -type f -exec chmod +x {} + 2>/dev/null || true
find "$APP_DIR/frontend/node_modules/.bin" -type f -exec chmod +x {} + 2>/dev/null || true

log "Installing Python dependencies"
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"

log "Running Django checks and migrations"
sudo -u deploy "$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" check
sudo -u deploy "$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" migrate --noinput
sudo -u deploy "$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" collectstatic --noinput

log "Restarting $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
systemctl is-active --quiet "$SERVICE_NAME"

log "Deployed $target_sha"
