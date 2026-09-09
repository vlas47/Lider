from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.http import FileResponse, Http404
from django.urls import path, reverse
from django.utils.html import format_html

from .models import WebsiteRequest


@admin.register(WebsiteRequest)
class WebsiteRequestAdmin(admin.ModelAdmin):
    list_display = ("created_at", "name", "phone", "service_slug", "status")
    list_filter = ("status", "service_slug")
    search_fields = ("name", "phone", "email", "comment")
    readonly_fields = ("created_at", "source_url", "name", "phone", "email", "comment", "service_slug", "consent", "download_brief")
    exclude = ("brief",)

    def get_urls(self):
        return [path("<int:pk>/brief/", self.admin_site.admin_view(self.brief_view), name="pages_websiterequest_brief")] + super().get_urls()

    @admin.display(description="Техническое задание")
    def download_brief(self, obj):
        if not obj.brief:
            return "Не приложено"
        return format_html('<a href="{}">Скачать файл</a>', reverse("admin:pages_websiterequest_brief", args=[obj.pk]))

    def brief_view(self, request, pk):
        obj = self.get_object(request, pk)
        if obj is None or not obj.brief:
            raise Http404
        if not self.has_view_permission(request, obj):
            raise PermissionDenied
        response = FileResponse(obj.brief.open("rb"), as_attachment=True, content_type="application/octet-stream")
        response["X-Content-Type-Options"] = "nosniff"
        return response
