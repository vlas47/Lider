from django.urls import path

from .views import ProfiLeadApiView, ProfiServerCommandView, ProfiServerScreenshotView


app_name = "profi"

urlpatterns = [
    path("api/leads/", ProfiLeadApiView.as_view(), name="leads-api"),
    path("api/server/", ProfiServerCommandView.as_view(), name="server-api"),
    path("api/server/screenshot.png", ProfiServerScreenshotView.as_view(), name="server-screenshot"),
]

