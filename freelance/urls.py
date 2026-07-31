from django.urls import path

from .views import FreelanceLeadApiView, FreelanceServerCommandView, FreelanceServerScreenshotView


app_name = "freelance"

urlpatterns = [
    path("api/leads/", FreelanceLeadApiView.as_view(), name="leads-api"),
    path("api/server/", FreelanceServerCommandView.as_view(), name="server-api"),
    path("api/server/screenshot.png", FreelanceServerScreenshotView.as_view(), name="server-screenshot"),
]
