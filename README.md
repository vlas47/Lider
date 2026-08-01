# AI_Lapin

Единый сервис поиска и оценки заявок с двумя независимыми приложениями:

- `profi` — Profi.ru;
- `freelance` — Freelance.ru;
- `leads` — общая модель заявок, скоринг и черновики ответов;
- `dashboard` — общие проекты, задачи и входящие;
- `frontend` — React/Vite интерфейс для всех приложений.

Backend работает на Django, production-данные хранятся в отдельной базе `ai_lapin` общего PostgreSQL-сервера. Браузерные сессии разделены: `profiles/profi/browser` и `profiles/freelance/browser`.

Для автоматического восстановления истёкшей сессии Freelance.ru задайте
`FREELANCE_LOGIN` и `FREELANCE_PASSWORD` только в серверном `.env`. Секреты не
добавляются в репозиторий; активная сессия сохраняется в
`profiles/freelance/browser`.

## Локальный запуск

```powershell
cd C:\Python\Lider\AI_Lapin
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

cd C:\Python\Lider\AI_Lapin\frontend
npm ci --no-audit --no-fund
npm run build

cd C:\Python\Lider\AI_Lapin
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8020
```

Интерфейс: `http://127.0.0.1:8020/`.

Локально без `.env` используется SQLite. В production обязателен `DATABASE_URL` для PostgreSQL.

## Production

```text
https://liderscan.ru/ai-lapin/
  -> nginx
  -> /run/ai-lapin/gunicorn.sock (Django API + React frontend)
  -> /run/ai-lapin-profi/gunicorn.sock (Profi.ru browser + monitor)
  -> /run/ai-lapin-freelance/gunicorn.sock (Freelance.ru browser + monitor)
  -> PostgreSQL / database ai_lapin
```

Мониторы работают в отдельных systemd-сервисах
`ai-lapin-profi-monitor.service` и `ai-lapin-freelance-monitor.service`.
Они автоматически запускаются после перезагрузки сервера, выполняют catch-up
верхних заявок и не останавливаются при перезапуске основного Gunicorn.

Первичная установка после копирования проекта в `/srv/AI_Lapin`:

```bash
sudo bash /srv/AI_Lapin/deploy/install-ai-lapin.sh
```

Обновление:

```bash
sudo -u deploy -g www-data /srv/AI_Lapin/deploy/deploy-ai-lapin.sh
```

Установщик не меняет базу `cloud_site`: он создаёт отдельную роль и базу `ai_lapin` в уже работающем экземпляре PostgreSQL. Nginx получает только маршрут `/ai-lapin/`, существующий публичный сайт остаётся отдельным сервисом.

## Проверки

```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py test
```

Система создаёт черновики и уведомления, но не отправляет отклики на площадках автоматически.
