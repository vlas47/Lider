#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="${1:?Usage: activate-release.sh /absolute/path/to/extracted/AI_Lapin}"
APP_DIR="${APP_DIR:-/srv/AI_Lapin}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/backups}"
STAMP="$(date -u +'%Y%m%dT%H%M%SZ')"
BACKUP_DIR="$BACKUP_ROOT/AI_Lapin-$STAMP"

SOURCE_DIR="$(realpath "$SOURCE_DIR")"
APP_PARENT="$(dirname "$APP_DIR")"
install -d -m 0750 "$APP_PARENT" "$BACKUP_ROOT"

case "$SOURCE_DIR" in
  "$APP_DIR"|"$APP_DIR"/*|"$BACKUP_ROOT"|"$BACKUP_ROOT"/*)
    echo "Release source must be outside $APP_DIR and $BACKUP_ROOT."
    exit 1
    ;;
esac

if [[ ! -f "$SOURCE_DIR/manage.py" || ! -f "$SOURCE_DIR/deploy/install-ai-lapin.sh" ]]; then
  echo "Invalid release directory: $SOURCE_DIR"
  exit 1
fi

had_service=0
if systemctl is-active --quiet ai-lapin.service; then
  had_service=1
  systemctl stop ai-lapin.service
fi

old_moved=0
rollback() {
  status=$?
  if [[ $status -eq 0 ]]; then
    return
  fi
  echo "Activation failed; restoring the previous application directory."
  systemctl stop ai-lapin.service 2>/dev/null || true
  if [[ -f "$BACKUP_DIR/.server-backup/ai_lapin.dump" ]]; then
    sudo -u postgres dropdb --if-exists ai_lapin || true
    sudo -u postgres createdb --owner=ai_lapin ai_lapin
    sudo -u postgres pg_restore --dbname=ai_lapin \
      "$BACKUP_DIR/.server-backup/ai_lapin.dump"
  fi
  if [[ -d "$APP_DIR" ]]; then
    mv "$APP_DIR" "$SOURCE_DIR.failed-$STAMP"
  fi
  if [[ $old_moved -eq 1 && -d "$BACKUP_DIR" ]]; then
    mv "$BACKUP_DIR" "$APP_DIR"
  fi
  if [[ -d "$APP_DIR/.server-backup" ]]; then
    cp -a "$APP_DIR/.server-backup/ai-lapin.service" \
      /etc/systemd/system/ai-lapin.service 2>/dev/null || true
    cp -a "$APP_DIR/.server-backup/nginx-cloud-site" \
      /etc/nginx/sites-available/cloud-site 2>/dev/null || true
    if [[ -f "$APP_DIR/.server-backup/nginx-ai-lapin-snippet" ]]; then
      cp -a "$APP_DIR/.server-backup/nginx-ai-lapin-snippet" \
        /etc/nginx/snippets/ai-lapin.conf
    fi
    systemctl daemon-reload || true
    nginx -t && systemctl reload nginx || true
  fi
  if [[ $had_service -eq 1 ]]; then
    systemctl start ai-lapin.service || true
  fi
  exit "$status"
}
trap rollback ERR

if [[ -d "$APP_DIR" ]]; then
  mv "$APP_DIR" "$BACKUP_DIR"
  old_moved=1
fi
install -d -o root -g postgres -m 0750 "$BACKUP_DIR/.server-backup"
if sudo -u postgres psql -Atc \
  "SELECT 1 FROM pg_database WHERE datname='ai_lapin'" | grep -q 1; then
  sudo -u postgres pg_dump --format=custom ai_lapin \
    > "$BACKUP_DIR/.server-backup/ai_lapin.dump"
  chown root:postgres "$BACKUP_DIR/.server-backup/ai_lapin.dump"
  chmod 0640 "$BACKUP_DIR/.server-backup/ai_lapin.dump"
fi
cp -a /etc/systemd/system/ai-lapin.service \
  "$BACKUP_DIR/.server-backup/ai-lapin.service" 2>/dev/null || true
cp -a /etc/nginx/sites-available/cloud-site \
  "$BACKUP_DIR/.server-backup/nginx-cloud-site"
cp -a /etc/nginx/snippets/ai-lapin.conf \
  "$BACKUP_DIR/.server-backup/nginx-ai-lapin-snippet" 2>/dev/null || true
mv "$SOURCE_DIR" "$APP_DIR"

legacy_env=""
legacy_sqlite=""
if [[ $old_moved -eq 1 ]]; then
  if [[ -f "$BACKUP_DIR/.env" ]]; then
    legacy_env="$BACKUP_DIR/.env"
  fi
  if [[ -f "$BACKUP_DIR/db.sqlite3" ]]; then
    cp -a "$BACKUP_DIR/db.sqlite3" "$APP_DIR/legacy-db.sqlite3"
    legacy_sqlite="$APP_DIR/legacy-db.sqlite3"
  fi
  if [[ -d "$BACKUP_DIR/profiles" ]]; then
    install -d "$APP_DIR/profiles"
    cp -a "$BACKUP_DIR/profiles/." "$APP_DIR/profiles/"
  elif [[ -d "$BACKUP_DIR/profi-browser-profile" ]]; then
    install -d "$APP_DIR/profiles/profi"
    cp -a "$BACKUP_DIR/profi-browser-profile" \
      "$APP_DIR/profiles/profi/browser"
  elif [[ -d "$BACKUP_DIR/desktop/user-data/Partitions/profi" ]]; then
    install -d "$APP_DIR/profiles/profi"
    cp -a "$BACKUP_DIR/desktop/user-data/Partitions/profi" \
      "$APP_DIR/profiles/profi/browser"
  fi
  if [[ -f "$BACKUP_DIR/profi-seen-orders.json" ]]; then
    install -d "$APP_DIR/profiles/profi"
    cp -a "$BACKUP_DIR/profi-seen-orders.json" \
      "$APP_DIR/profiles/profi/seen-orders.json"
  fi
  if [[ -d "$BACKUP_DIR/certs" ]]; then
    cp -a "$BACKUP_DIR/certs" "$APP_DIR/certs"
  fi
fi

LEGACY_ENV_PATH="$legacy_env" LEGACY_SQLITE_PATH="$legacy_sqlite" \
  bash "$APP_DIR/deploy/install-ai-lapin.sh"

trap - ERR
echo "Activated $APP_DIR. Previous version: ${BACKUP_DIR:-none}"
