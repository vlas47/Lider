from django.urls import path

from .views import HomeView, PlaceholderView

app_name = "pages"

urlpatterns = [
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
        ),
        name="service-login",
    ),
]
