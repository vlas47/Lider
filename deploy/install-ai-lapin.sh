#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/AI_Lapin}"
SERVICE_FILE="/etc/systemd/system/ai-lapin.service"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/cloud-site}"
NGINX_SNIPPET="/etc/nginx/snippets/ai-lapin.conf"
LEGACY_ENV_PATH="${LEGACY_ENV_PATH:-}"
LEGACY_SQLITE_PATH="${LEGACY_SQLITE_PATH:-}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "$APP_DIR does not exist. Copy AI_Lapin there first."
  exit 1
fi

# The deploy service needs traverse permission on /srv, but not directory listing.
chmod o+x "$(dirname "$APP_DIR")"

if ! id deploy >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin deploy
fi

install -d -o deploy -g www-data -m 0750 \
  "$APP_DIR/profiles/profi/browser" \
  "$APP_DIR/profiles/freelance/browser"

if [[ ! -f "$APP_DIR/.env" ]]; then
  db_password="$(openssl rand -hex 24)"
  django_secret="$(openssl rand -hex 48)"
  app_password="$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 24)"
  desktop_token="$(openssl rand -hex 32)"
  sed \
    -e "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=$django_secret|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://ai_lapin:$db_password@127.0.0.1:5432/ai_lapin|" \
    -e "s|^AI_LAPIN_PASSWORD=.*|AI_LAPIN_PASSWORD=$app_password|" \
    -e "s|^AI_LAPIN_DESKTOP_TOKEN=.*|AI_LAPIN_DESKTOP_TOKEN=$desktop_token|" \
    "$APP_DIR/deploy/ai-lapin.env.example" > "$APP_DIR/.env"
  printf '%s\n' "$app_password" > /root/ai-lapin-login-password.initial
  chown deploy:www-data "$APP_DIR/.env"
  chmod 640 "$APP_DIR/.env"
  chmod 600 /root/ai-lapin-login-password.initial
fi

if [[ -n "$LEGACY_ENV_PATH" && -f "$LEGACY_ENV_PATH" ]]; then
  python3 - "$LEGACY_ENV_PATH" "$APP_DIR/.env" <<'PY'
from pathlib import Path
import sys

allowed = {
    "DJANGO_SECRET_KEY",
    "DATABASE_URL",
    "AI_LAPIN_PASSWORD",
    "AI_LAPIN_DESKTOP_TOKEN",
    "AI_DRAFT_ENDPOINT",
    "AI_DRAFT_API_KEY",
    "OPENAI_API_KEY",
    "OPENAI_API_BASE",
    "OPENAI_MODEL",
    "MAX_API_BASE",
    "MAX_BOT_TOKEN",
    "MAX_RECIPIENT_ID",
    "MAX_RECIPIENT_KIND",
    "MAX_CA_BUNDLE",
    "FREELANCE_LOGIN",
    "FREELANCE_PASSWORD",
}


def read_env(path):
    values = {}
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value
    return values


old_values = read_env(sys.argv[1])
target = Path(sys.argv[2])
lines = target.read_text(encoding="utf-8").splitlines()
for index, line in enumerate(lines):
    if "=" not in line or line.lstrip().startswith("#"):
        continue
    key = line.split("=", 1)[0].strip()
    if key in allowed and old_values.get(key):
        lines[index] = f"{key}={old_values[key]}"
target.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY
fi

if [[ -f /root/ai-lapin-login-password.initial ]]; then
  python3 - "$APP_DIR/.env" /root/ai-lapin-login-password.initial <<'PY'
from pathlib import Path
import os
import sys

password = ""
for raw in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    if raw.startswith("AI_LAPIN_PASSWORD="):
        password = raw.split("=", 1)[1]
        break
if password:
    target = Path(sys.argv[2])
    target.write_text(password + "\n", encoding="utf-8")
    os.chmod(target, 0o600)
PY
fi

db_password="$(sed -nE 's|^DATABASE_URL=postgresql://ai_lapin:([^@]+)@.*|\1|p' "$APP_DIR/.env" | head -n1)"
if [[ -z "$db_password" ]]; then
  echo "DATABASE_URL for ai_lapin is missing or malformed in $APP_DIR/.env"
  exit 1
fi

if command -v psql >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ai_lapin'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER ROLE ai_lapin WITH LOGIN PASSWORD '$db_password';"
  else
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE ai_lapin WITH LOGIN PASSWORD '$db_password';"
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ai_lapin'" | grep -q 1; then
    sudo -u postgres createdb --owner=ai_lapin ai_lapin
  fi
else
  echo "PostgreSQL client/server is required before installing AI_Lapin."
  exit 1
fi

if [[ ! -d "$APP_DIR/venv" ]]; then
  python3 -m venv "$APP_DIR/venv"
fi

"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt"
PLAYWRIGHT_BROWSERS_PATH="$APP_DIR/.playwright-browsers" \
  "$APP_DIR/venv/bin/playwright" install --only-shell chromium

if command -v npm >/dev/null 2>&1; then
  if ! (npm --prefix "$APP_DIR/frontend" ci --no-audit --no-fund && \
        npm --prefix "$APP_DIR/frontend" run build); then
    if [[ -f "$APP_DIR/frontend/dist/index.html" ]]; then
      echo "npm build failed; using the verified prebuilt frontend/dist."
    else
      exit 1
    fi
  fi
elif [[ ! -f "$APP_DIR/frontend/dist/index.html" ]]; then
  echo "npm is required because frontend/dist is missing. Install Node.js 20+ and rerun."
  exit 1
fi

"$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" check
sudo -u deploy -g www-data "$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" migrate --noinput
if [[ -z "$LEGACY_SQLITE_PATH" ]]; then
  if [[ -f "$APP_DIR/legacy-db.sqlite3" ]]; then
    LEGACY_SQLITE_PATH="$APP_DIR/legacy-db.sqlite3"
  elif [[ -f "$APP_DIR/db.sqlite3" ]]; then
    LEGACY_SQLITE_PATH="$APP_DIR/db.sqlite3"
  fi
fi
if [[ -n "$LEGACY_SQLITE_PATH" && -f "$LEGACY_SQLITE_PATH" ]]; then
  sudo -u deploy -g www-data "$APP_DIR/venv/bin/python" \
    "$APP_DIR/manage.py" import_legacy_sqlite "$LEGACY_SQLITE_PATH"
fi
"$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" collectstatic --noinput

cp "$APP_DIR/deploy/ai-lapin.service" "$SERVICE_FILE"
cp "$APP_DIR/deploy/nginx-ai-lapin-location.conf" "$NGINX_SNIPPET"

if [[ ! -f "$NGINX_SITE" ]]; then
  echo "Nginx site not found: $NGINX_SITE"
  exit 1
fi

cp -a "$NGINX_SITE" "$NGINX_SITE.ai-lapin.$(date -u +'%Y%m%dT%H%M%SZ').bak"
python3 - "$NGINX_SITE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
marker = "include /etc/nginx/snippets/ai-lapin.conf;"
lines = []
skip_depth = 0
pattern = re.compile(r"^\s*location\s+(?:=\s+)?/ai-lapin(?:\S*)?\s*\{")
for line in text.splitlines():
    if skip_depth:
        skip_depth += line.count("{") - line.count("}")
        continue
    if pattern.match(line):
        skip_depth = line.count("{") - line.count("}")
        continue
    if marker not in line:
        lines.append(line)

for index, line in enumerate(lines):
    if "server_name" in line and "liderscan.ru" in line:
        indent = line[: len(line) - len(line.lstrip())]
        lines.insert(index + 1, f"{indent}{marker}")
        break
else:
    raise SystemExit("Could not find the liderscan.ru TLS server block")
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PY

chown -R deploy:www-data "$APP_DIR"
find "$APP_DIR" \
  \( -path "$APP_DIR/venv" -o \
     -path "$APP_DIR/frontend/node_modules" -o \
     -path "$APP_DIR/.playwright-browsers" -o \
     -path "$APP_DIR/profiles" \) -prune -o \
  -type d -exec chmod 0750 {} +
find "$APP_DIR" \
  \( -path "$APP_DIR/venv" -o \
     -path "$APP_DIR/frontend/node_modules" -o \
     -path "$APP_DIR/.playwright-browsers" -o \
     -path "$APP_DIR/profiles" \) -prune -o \
  -type f -exec chmod 0640 {} +
chmod 0750 "$APP_DIR"/deploy/*.sh
chmod 640 "$APP_DIR/.env"
systemctl daemon-reload
systemctl enable --now ai-lapin.service
nginx -t
systemctl reload nginx

for attempt in {1..30}; do
  if curl --fail --silent -H 'Host: liderscan.ru' \
    -H 'X-Forwarded-Proto: https' \
    --unix-socket /run/ai-lapin/gunicorn.sock \
    http://localhost/health/ >/dev/null 2>&1; then
    break
  fi
  if [[ $attempt -eq 30 ]]; then
    echo "AI_Lapin socket health check failed."
    exit 1
  fi
  sleep 1
done
curl --fail --silent --show-error https://liderscan.ru/ai-lapin/health/ >/dev/null

echo "AI_Lapin installed at https://liderscan.ru/ai-lapin/"
if [[ -f /root/ai-lapin-login-password.initial ]]; then
  echo "Initial login password is stored in /root/ai-lapin-login-password.initial (root-only)."
fi
