from django.conf import settings

from leads.server_browser import PlatformServerBrowser
from leads.services import create_profi_lead_from_text

from .models import ProfiLead


server_browser = PlatformServerBrowser(
    source_label="Profi.ru",
    default_url=settings.PROFI_DEFAULT_URL,
    allowed_domains=("profi.ru",),
    profile_dir=settings.PROFI_BROWSER_PROFILE_DIR,
    seen_path=settings.PROFI_SEEN_ORDERS_PATH,
    lead_model=ProfiLead,
    lead_factory=create_profi_lead_from_text,
    monitor_min_seconds=settings.PROFI_MONITOR_MIN_SECONDS,
    monitor_max_seconds=settings.PROFI_MONITOR_MAX_SECONDS,
    monitor_score_threshold=settings.PROFI_MONITOR_SCORE_THRESHOLD,
)

