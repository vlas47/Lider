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
