# Lapin Systems

Clean Django + React landing page for a web-systems development company.

## Local Start

```powershell
.\.venv\Scripts\Activate.ps1
cd frontend
npm run build
cd ..
$env:DJANGO_DEBUG='1'
python manage.py runserver 127.0.0.1:8015
```

## Checks

```powershell
cd frontend
npm run build
cd ..
$env:USE_SQLITE_FALLBACK='1'
python manage.py check
python manage.py test pages
python manage.py collectstatic --noinput
```

Production uses PostgreSQL. The `USE_SQLITE_FALLBACK=1` flag is only for quick local checks without a running Postgres instance.

## Git Workflow

- `main` is the production-ready branch.
- New work should be done in feature branches, for example `feature/home-copy` or `bugfix/mobile-carousel`.
- Merge changes through pull requests after `npm run build` and `python manage.py check`.
- Do not commit `.env`, server access files, virtual environments, collected static files, or archives.

## Production Deploy

Production `/srv/cloud_site` is a git checkout of `main`.

Server deployment is handled by `deploy/lider-deploy-main.sh` through `systemd`:

```bash
sudo systemctl start lider-deploy.service
sudo systemctl status lider-deploy.timer
```

Install the deploy script and units as root during provisioning. The timer runs
the script as the unprivileged `deploy` user; repository code must not update
systemd units. Allow only the application restart command through sudo:

```text
deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart cloud-site.service
```

The checkout, virtual environment, frontend dependencies, and cache directories
under `/srv/cloud_site` must be owned by `deploy:www-data`.

The deploy script fetches `origin/main`, resets the checkout to it, builds the React frontend, installs Python dependencies, runs Django checks, migrations, `collectstatic`, and restarts `cloud-site.service`.

## Production Env

Set production values through environment variables:

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG=0`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
