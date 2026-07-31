from pathlib import Path

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve

from freelance.views import FreelanceServerCommandView, FreelanceServerScreenshotView
from profi.views import ProfiLeadApiView, ProfiServerCommandView, ProfiServerScreenshotView

from .frontend_views import (
    AuthStatusView,
    DashboardSummaryView,
    FrontendView,
    LoginView,
    LogoutView,
    frontend_redirect,
)


def health(request):
    with connection.cursor() as cursor:
        cursor.execute("SELECT 1")
        cursor.fetchone()
    return JsonResponse({"status": "ok", "database": "ok"})


urlpatterns = [
    path("health/", health, name="health"),
    path("api/auth/status/", AuthStatusView.as_view(), name="auth-status"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/dashboard/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("profi/", include("profi.urls")),
    path("freelance/", include("freelance.urls")),
    # Compatibility endpoints used by the first Profi client.
    path("api/profi/leads/", ProfiLeadApiView.as_view(), name="profi-leads-api"),
    path("api/profi-server/", ProfiServerCommandView.as_view(), name="profi-server-api"),
    path("api/profi-server/screenshot.png", ProfiServerScreenshotView.as_view(), name="profi-server-screenshot"),
    path("api/freelance-server/", FreelanceServerCommandView.as_view(), name="freelance-server-api"),
    path("api/freelance-server/screenshot.png", FreelanceServerScreenshotView.as_view(), name="freelance-server-screenshot"),
    path("profi-server/", frontend_redirect("profi"), name="profi-server"),
    path("profi-radar/", frontend_redirect("profi"), name="profi-radar"),
    path("profi-session/", frontend_redirect("profi"), name="profi-session"),
    path("freelance-server/", frontend_redirect("freelance"), name="freelance-server"),
    path("ai-lapin/", FrontendView.as_view(), name="ai-lapin"),
    path("", FrontendView.as_view(), name="home"),
]

if settings.DEBUG:
    assets_root = Path(settings.BASE_DIR) / "frontend" / "dist" / "assets"
    urlpatterns = [
        re_path(r"^assets/(?P<path>.*)$", serve, {"document_root": assets_root}),
        re_path(r"^ai-lapin/assets/(?P<path>.*)$", serve, {"document_root": assets_root}),
        *urlpatterns,
    ]
