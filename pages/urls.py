from django.urls import path
from django.views.generic import RedirectView

from .views import (
    GoogleSiteVerificationView,
    HomeView,
    PlaceholderView,
    RobotsTxtView,
    SitemapXmlView,
)

app_name = "pages"

urlpatterns = [
    path("robots.txt", RobotsTxtView.as_view(), name="robots"),
    path("sitemap.xml", SitemapXmlView.as_view(), name="sitemap"),
    path(
        "google5c5d79fc4edf432f.html",
        GoogleSiteVerificationView.as_view(),
        name="google-site-verification",
    ),
    path(
        "favicon.ico",
        RedirectView.as_view(url="/static/img/favicon-32.png", permanent=True),
        name="favicon",
    ),
    path("", HomeView.as_view(), name="home"),
    path(
        "industrial-digitization/",
        PlaceholderView.as_view(
            title="Промышленная оцифровка",
            text="Раздел будет собран как отдельная услуга Lapin Systems: OCR, электронные архивы, загрузка документов и поиск по данным.",
        ),
        name="industrial-digitization",
    ),
    path(
        "service/login/",
        PlaceholderView.as_view(
            title="Вход в кабинет",
            text="Личный кабинет будет собран отдельным модулем в новом интерфейсе Lapin Systems.",
            robots="noindex,nofollow",
        ),
        name="service-login",
    ),
]
