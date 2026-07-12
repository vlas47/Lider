from django.conf import settings
from django.templatetags.static import static


DEFAULT_SEO_TITLE = "Lapin Systems · Автоматизируем ежедневные процессы бизнеса"
DEFAULT_SEO_DESCRIPTION = (
    "Lapin Systems разрабатывает CRM, WMS, личные кабинеты, сервисные платформы, "
    "интернет-магазины и интеграции для ежедневных процессов бизнеса."
)


def site_meta(request):
    base_url = getattr(settings, "SITE_BASE_URL", "https://liderscan.ru").rstrip("/")
    path = request.path if request else "/"
    canonical_url = f"{base_url}{path}"

    return {
        "seo_title": DEFAULT_SEO_TITLE,
        "seo_description": DEFAULT_SEO_DESCRIPTION,
        "seo_robots": "index,follow",
        "canonical_url": canonical_url,
        "site_base_url": base_url,
        "og_image_url": f"{base_url}{static('img/lapin-systems-logo.png')}",
    }
