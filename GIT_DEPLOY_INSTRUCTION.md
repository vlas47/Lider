# GitHub -> VPS deploy инструкция

## Что сейчас настроено

AI_Lapin живет отдельно от публичного лендинга.

- Публичный лендинг: ветка `main`.
- Серверное приложение AI_Lapin: ветка `ai-lapin-prod`.
- Прод-каталог на VPS: `/srv/AI_Lapin`.
- Сервис приложения: `ai-lapin.service`.
- Деплойный сервис: `ai-lapin-deploy.service`.
- Автопроверка GitHub: `ai-lapin-deploy.timer`.

Схема работы:

```text
GitHub / ai-lapin-prod
  -> VPS user deploy
  -> git fetch/reset
  -> npm build
  -> Django check/migrate/collectstatic
  -> restart ai-lapin.service
```

## Как разработчику вносить изменения

1. Клонировать репозиторий:

```bash
git clone git@github.com:vlas47/Lider.git
cd Lider
git checkout ai-lapin-prod
```

2. Создать рабочую ветку:

```bash
git checkout -b feature/my-change
```

3. Сделать изменения и локально проверить:

```bash
cd frontend
npm ci --no-audit --no-fund
npm run build

cd ..
python -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py test
```

На Windows команды Python будут такими:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe manage.py test
```

4. Запушить ветку и открыть Pull Request в `ai-lapin-prod`:

```bash
git add -A
git commit -m "Описание изменения"
git push -u origin feature/my-change
```

5. После merge в `ai-lapin-prod` VPS сам подтянет изменения.

## Как работает автодеплой

На сервере включен timer:

```bash
systemctl status ai-lapin-deploy.timer
systemctl list-timers --all ai-lapin-deploy.timer
```

Timer примерно раз в 2 минуты запускает:

```bash
systemctl start ai-lapin-deploy.service
```

Если commit в GitHub не изменился, скрипт выходит без сборки и без рестарта.
Если commit новый, выполняется полный deploy.

## Ручной deploy

Если нужно применить изменения сразу:

```bash
sudo systemctl start ai-lapin-deploy.service
sudo systemctl status ai-lapin-deploy.service --no-pager -l
```

Проверка приложения:

```bash
sudo systemctl status ai-lapin.service --no-pager -l
curl -fsS https://liderscan.ru/ai-lapin/health/
```

Ожидаемый health:

```json
{"status": "ok", "database": "ok"}
```

## Логи

Логи приложения:

```bash
sudo journalctl -u ai-lapin.service -n 100 --no-pager
```

Логи деплоя:

```bash
sudo journalctl -u ai-lapin-deploy.service -n 100 --no-pager
```

## Важные правила

- Не коммитить `.env`.
- Не коммитить ключи, токены, пароли.
- Не коммитить `venv`, `.venv`, `profiles`, `.playwright-browsers`, `frontend/node_modules`, `frontend/dist`, `staticfiles`, `db.sqlite3`.
- Все production-секреты лежат только на VPS в `/srv/AI_Lapin/.env`.
- База на production: PostgreSQL через `DATABASE_URL`.
- Профили браузеров Profi/Freelance сохраняются на сервере в `profiles`.

## Что сохраняется при deploy

Скрипт специально не удаляет:

- `/srv/AI_Lapin/.env`
- `/srv/AI_Lapin/venv`
- `/srv/AI_Lapin/profiles`
- `/srv/AI_Lapin/.playwright-browsers`
- `/srv/AI_Lapin/frontend/node_modules`
- `/srv/AI_Lapin/frontend/dist`
- `/srv/AI_Lapin/staticfiles`

## Rollback

Посмотреть историю:

```bash
cd /srv/AI_Lapin
sudo -u deploy git log --oneline -10
```

Откатиться к конкретному commit:

```bash
cd /srv/AI_Lapin
sudo systemctl stop ai-lapin-deploy.timer
sudo -u deploy git reset --hard <commit_sha>
sudo systemctl restart ai-lapin.service
curl -fsS https://liderscan.ru/ai-lapin/health/
```

После проверки вернуть автодеплой:

```bash
sudo systemctl start ai-lapin-deploy.timer
```

Лучше после rollback сразу исправить проблему в GitHub и вернуть ветку `ai-lapin-prod` в рабочее состояние.

## Быстрая диагностика

Проверить, какой commit стоит на сервере:

```bash
sudo -u deploy git -C /srv/AI_Lapin status --short --branch
sudo -u deploy git -C /srv/AI_Lapin rev-parse HEAD
```

Проверить, что сервис активен:

```bash
systemctl is-active ai-lapin.service
```

Проверить, что автодеплой активен:

```bash
systemctl is-active ai-lapin-deploy.timer
```

