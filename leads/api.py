import json

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from .quick_replies import build_quick_replies, build_suggested_quick_reply


SESSION_KEY = "ai_lapin_access_granted"


def api_allowed(request):
    if request.session.get(SESSION_KEY):
        return True
    token = getattr(settings, "AI_LAPIN_DESKTOP_TOKEN", "")
    if token:
        return request.headers.get("X-AI-Lapin-Token") == token
    return bool(settings.DEBUG and request.META.get("REMOTE_ADDR") in {"127.0.0.1", "::1"})


def serialize_lead(lead):
    quick_replies = build_quick_replies(lead)
    suggested_reply = build_suggested_quick_reply(lead)
    return {
        "id": lead.id,
        "source": lead.source,
        "source_label": lead.get_source_display(),
        "title": lead.title,
        "source_url": lead.source_url,
        "raw_text": lead.raw_text,
        "client_hint": lead.client_hint,
        "category": lead.category,
        "budget_hint": lead.budget_hint,
        "published_hint": lead.published_hint,
        "score": lead.score,
        "verdict": lead.verdict,
        "ai_notes": lead.ai_notes,
        "draft_reply": lead.draft_reply,
        "quick_replies": quick_replies,
        "suggested_reply_id": suggested_reply["id"],
        "suggested_reply_label": suggested_reply["label"],
        "suggested_reply": suggested_reply["reply"],
        "status": lead.status,
        "status_label": lead.get_status_display(),
        "max_status": lead.max_status,
        "created_at": timezone.localtime(lead.created_at).strftime("%d.%m %H:%M"),
        "updated_at": timezone.localtime(lead.updated_at).strftime("%d.%m %H:%M"),
    }


@method_decorator(csrf_exempt, name="dispatch")
class PlatformServerCommandView(View):
    browser = None
    lead_model = None

    def get(self, request, *args, **kwargs):
        if not api_allowed(request):
            return HttpResponseForbidden("Forbidden")
        return JsonResponse({"status": self.browser.status(), "leads": self.latest_leads()})

    def post(self, request, *args, **kwargs):
        if not api_allowed(request):
            return HttpResponseForbidden("Forbidden")
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "bad_json"}, status=400)

        action = payload.get("action", "")
        try:
            if action == "start":
                self.browser.start()
                status = self.browser.status()
            elif action == "stop":
                status = self.browser.stop()
            elif action == "goto":
                status = self.browser.goto(payload.get("url", ""))
            elif action == "reload":
                status = self.browser.reload()
            elif action == "back":
                status = self.browser.back()
            elif action == "click":
                status = self.browser.click(payload.get("x", 0), payload.get("y", 0))
            elif action == "type":
                status = self.browser.type_text(payload.get("text", ""))
            elif action == "press":
                status = self.browser.press(payload.get("key", "Enter"))
            elif action == "scroll":
                status = self.browser.scroll(payload.get("delta_y", 420))
            elif action == "scan":
                result = self.browser.scan(
                    refresh=bool(payload.get("refresh")),
                    threshold=payload.get("threshold"),
                    force=bool(payload.get("force")),
                )
                return JsonResponse({"status": self.browser.status(), "scan": result, "leads": self.latest_leads()})
            elif action == "monitor_start":
                status = self.browser.start_monitor()
            elif action == "monitor_stop":
                status = self.browser.stop_monitor()
            else:
                return JsonResponse({"error": "unknown_action"}, status=400)
        except Exception as error:
            return JsonResponse(
                {"error": str(error), "status": self.browser.status(), "leads": self.latest_leads()},
                status=500,
            )
        return JsonResponse({"status": status, "leads": self.latest_leads()})

    def latest_leads(self):
        return [serialize_lead(lead) for lead in self.lead_model.objects.order_by("-updated_at")[:8]]


class PlatformServerScreenshotView(View):
    browser = None

    def get(self, request, *args, **kwargs):
        if not api_allowed(request):
            return HttpResponseForbidden("Forbidden")
        if not self.browser.status().get("started"):
            return HttpResponse(
                "Browser is stopped",
                status=409,
                content_type="text/plain; charset=utf-8",
            )
        try:
            image = self.browser.screenshot()
        except Exception as error:
            return HttpResponse(str(error), status=503, content_type="text/plain; charset=utf-8")
        response = HttpResponse(image, content_type="image/png")
        response["Cache-Control"] = "no-store, max-age=0"
        return response


@method_decorator(csrf_exempt, name="dispatch")
class PlatformLeadApiView(View):
    lead_model = None
    lead_factory = None

    def get(self, request, *args, **kwargs):
        if not api_allowed(request):
            return HttpResponseForbidden("Forbidden")
        leads = [serialize_lead(lead) for lead in self.lead_model.objects.order_by("-updated_at")[:20]]
        return JsonResponse({"leads": leads})

    def post(self, request, *args, **kwargs):
        if not api_allowed(request):
            return HttpResponseForbidden("Forbidden")
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"error": "bad_json"}, status=400)
        raw_text = (payload.get("text") or "").strip()
        if not raw_text:
            return JsonResponse({"error": "empty_text"}, status=400)
        kwargs = {
            "source_url": payload.get("source_url", ""),
            "client_hint": payload.get("client_hint", ""),
        }
        for key in ("source_id", "category", "published_hint"):
            if payload.get(key):
                kwargs[key] = payload[key]
        lead = self.lead_factory(raw_text, **kwargs)
        return JsonResponse({"lead": serialize_lead(lead)})
