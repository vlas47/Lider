import json
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, HttpResponse, HttpResponseForbidden, HttpResponseRedirect, JsonResponse
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie

from dashboard.models import InboxItem, Project, Task
from leads.models import Lead


SESSION_KEY = "ai_lapin_access_granted"


@method_decorator(ensure_csrf_cookie, name="dispatch")
class FrontendView(View):
    def get(self, request, *args, **kwargs):
        index_path = Path(settings.BASE_DIR) / "frontend" / "dist" / "index.html"
        if not index_path.is_file():
            return HttpResponse(
                "AI_Lapin frontend is not built. Run: cd frontend && npm ci && npm run build",
                status=503,
                content_type="text/plain; charset=utf-8",
            )
        get_token(request)
        return FileResponse(index_path.open("rb"), content_type="text/html; charset=utf-8")


def frontend_redirect(section=""):
    def view(request):
        prefix = (settings.FORCE_SCRIPT_NAME or "").rstrip("/")
        fragment = f"#/{section}" if section else "#/"
        return HttpResponseRedirect(f"{prefix}/{fragment}")

    return view


class AuthStatusView(View):
    def get(self, request):
        return JsonResponse(
            {
                "authenticated": bool(request.session.get(SESSION_KEY)),
                "csrf_token": get_token(request),
            }
        )


class LoginView(View):
    def post(self, request):
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "bad_json"}, status=400)
        if payload.get("password", "") != settings.AI_LAPIN_PASSWORD:
            return JsonResponse({"error": "Неверный пароль доступа."}, status=400)
        request.session[SESSION_KEY] = True
        return JsonResponse({"authenticated": True})


class LogoutView(View):
    def post(self, request):
        request.session.pop(SESSION_KEY, None)
        return JsonResponse({"authenticated": False})


class DashboardSummaryView(View):
    def get(self, request):
        if not request.session.get(SESSION_KEY):
            return HttpResponseForbidden("Forbidden")
        active_tasks = Task.objects.exclude(status=Task.STATUS_DONE)
        recent_leads = Lead.objects.order_by("-updated_at")[:8]
        return JsonResponse(
            {
                "stats": {
                    "today": active_tasks.filter(status__in=[Task.STATUS_TODO, Task.STATUS_DOING]).count(),
                    "inbox": InboxItem.objects.filter(status=InboxItem.STATUS_NEW).count(),
                    "projects": Project.objects.filter(status=Project.STATUS_ACTIVE).count(),
                    "risks": active_tasks.filter(priority=1).count(),
                    "profi": Lead.objects.filter(source=Lead.SOURCE_PROFI, score__gte=38).count(),
                    "freelance": Lead.objects.filter(source=Lead.SOURCE_FREELANCE, score__gte=38).count(),
                },
                "recent_leads": [
                    {
                        "id": lead.id,
                        "source": lead.source,
                        "source_label": lead.get_source_display(),
                        "title": lead.title,
                        "score": lead.score,
                        "verdict": lead.verdict,
                        "source_url": lead.source_url,
                    }
                    for lead in recent_leads
                ],
            }
        )

