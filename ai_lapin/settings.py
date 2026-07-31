import os
from pathlib import Path
from urllib.parse import unquote, urlparse


BASE_DIR = Path(__file__).resolve().parent.parent


def load_local_env(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip().lstrip("\ufeff")
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_local_env(BASE_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "ai-lapin-development-key")
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,liderscan.ru,www.liderscan.ru,ai.liderscan.ru").split(",")
    if host.strip()
]
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "https://liderscan.ru,https://www.liderscan.ru,https://ai.liderscan.ru,http://127.0.0.1:8020").split(",")
    if origin.strip()
]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "leads",
    "profi",
    "freelance",
    "dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "ai_lapin.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "ai_lapin.wsgi.application"
ASGI_APPLICATION = "ai_lapin.asgi.application"

def database_from_url(value: str) -> dict:
    parsed = urlparse(value)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ValueError("DATABASE_URL supports only postgres/postgresql for production.")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/")),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
    }


DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL:
    DATABASES = {"default": database_from_url(DATABASE_URL)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

LANGUAGE_CODE = "ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
FORCE_SCRIPT_NAME = os.getenv("DJANGO_FORCE_SCRIPT_NAME") or None

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_NAME = "ai_lapin_sessionid"
CSRF_COOKIE_NAME = "ai_lapin_csrftoken"

AI_LAPIN_PASSWORD = os.getenv("AI_LAPIN_PASSWORD", "123")
AI_LAPIN_DESKTOP_TOKEN = os.getenv("AI_LAPIN_DESKTOP_TOKEN", "")

AI_DRAFT_ENDPOINT = os.getenv("AI_DRAFT_ENDPOINT", "")
AI_DRAFT_API_KEY = os.getenv("AI_DRAFT_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

MAX_API_BASE = os.getenv("MAX_API_BASE", "https://platform-api2.max.ru")
MAX_BOT_TOKEN = os.getenv("MAX_BOT_TOKEN", "")
MAX_RECIPIENT_ID = os.getenv("MAX_RECIPIENT_ID", "")
MAX_RECIPIENT_KIND = os.getenv("MAX_RECIPIENT_KIND", "chat_id")
MAX_CA_BUNDLE = os.getenv("MAX_CA_BUNDLE", "")

PROFI_DEFAULT_URL = os.getenv("PROFI_DEFAULT_URL", "https://profi.ru/backoffice/n.php")
PROFILES_ROOT = Path(os.getenv("AI_LAPIN_PROFILES_ROOT", str(BASE_DIR / "profiles")))
PROFI_BROWSER_PROFILE_DIR = os.getenv("PROFI_BROWSER_PROFILE_DIR", str(PROFILES_ROOT / "profi" / "browser"))
PROFI_SEEN_ORDERS_PATH = os.getenv("PROFI_SEEN_ORDERS_PATH", str(PROFILES_ROOT / "profi" / "seen-orders.json"))
PROFI_MONITOR_MIN_SECONDS = int(os.getenv("PROFI_MONITOR_MIN_SECONDS", "60"))
PROFI_MONITOR_MAX_SECONDS = int(os.getenv("PROFI_MONITOR_MAX_SECONDS", "300"))
PROFI_MONITOR_SCORE_THRESHOLD = int(os.getenv("PROFI_MONITOR_SCORE_THRESHOLD", "51"))

FREELANCE_DEFAULT_URL = os.getenv(
    "FREELANCE_DEFAULT_URL",
    "https://freelance.ru/task?q=&c%5B%5D=4&a=1&v=1",
)
FREELANCE_BROWSER_PROFILE_DIR = os.getenv("FREELANCE_BROWSER_PROFILE_DIR", str(PROFILES_ROOT / "freelance" / "browser"))
FREELANCE_SEEN_ORDERS_PATH = os.getenv("FREELANCE_SEEN_ORDERS_PATH", str(PROFILES_ROOT / "freelance" / "seen-orders.json"))
FREELANCE_LOGIN = os.getenv("FREELANCE_LOGIN", "").strip()
FREELANCE_PASSWORD = os.getenv("FREELANCE_PASSWORD", "")
FREELANCE_MONITOR_MIN_SECONDS = int(os.getenv("FREELANCE_MONITOR_MIN_SECONDS", "60"))
FREELANCE_MONITOR_MAX_SECONDS = int(os.getenv("FREELANCE_MONITOR_MAX_SECONDS", "300"))
FREELANCE_MONITOR_SCORE_THRESHOLD = int(os.getenv("FREELANCE_MONITOR_SCORE_THRESHOLD", "51"))

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "1") == "1"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", "0") == "1"
    SECURE_HSTS_PRELOAD = os.getenv("DJANGO_SECURE_HSTS_PRELOAD", "0") == "1"
