from datetime import date
from xml.sax.saxutils import escape

from django.conf import settings
from django.http import HttpResponse
from django.templatetags.static import static
from django.urls import reverse
from django.views import View
from django.views.generic import TemplateView


def site_url(path):
    base_url = getattr(settings, "SITE_BASE_URL", "https://liderscan.ru").rstrip("/")
    return f"{base_url}{path}"


class HomeView(TemplateView):
    template_name = "pages/home.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["home_config"] = {
            "images": {
                "founder": static("img/founder-photo.png"),
                "nextGen": static("img/next-gen-photo.jpg"),
                "portfolioDomkapsul": static("img/portfolio-domkapsul.jpg"),
                "portfolioFullbox": static("img/portfolio-fullbox.jpg"),
                "portfolioNozbart": static("img/portfolio-nozbart-russia.png"),
                "portfolioAshtanga": static("img/portfolio-ashtanga-yoga.jpg"),
                "portfolioSoyz": static("img/portfolio-soyz-zastroi.jpg"),
            },
            "urls": {
                "contact": "#contact",
                "phone": "tel:+79180916494",
                "industrial": reverse("pages:industrial-digitization"),
                "cabinet": reverse("pages:service-login"),
            },
            "cabinetLabel": "Вход в кабинет",
        }
        return context


class PlaceholderView(TemplateView):
    template_name = "pages/placeholder.html"
    title = ""
    text = ""
    robots = "index,follow"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title
        context["text"] = self.text
        context["seo_title"] = f"{self.title} · Lapin Systems"
        context["seo_description"] = self.text
        context["seo_robots"] = self.robots
        return context


class RobotsTxtView(View):
    def get(self, request, *args, **kwargs):
        lines = [
            "User-agent: *",
            "Allow: /",
            "Disallow: /admin/",
            "Disallow: /service/",
            "",
            f"Sitemap: {site_url('/sitemap.xml')}",
            f"Host: {getattr(settings, 'SITE_CANONICAL_HOST', 'liderscan.ru')}",
            "",
        ]
        return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")


class GoogleSiteVerificationView(View):
    filename = "google5c5d79fc4edf432f.html"

    def get(self, request, *args, **kwargs):
        return HttpResponse(
            f"google-site-verification: {self.filename}",
            content_type="text/html; charset=utf-8",
        )


class YandexSiteVerificationView(View):
    verification_code = "3b68de66631d6409"

    def get(self, request, *args, **kwargs):
        content = (
            "<html>\n"
            "    <head>\n"
            '        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n'
            "    </head>\n"
            f"    <body>Verification: {self.verification_code}</body>\n"
            "</html>"
        )
        return HttpResponse(content, content_type="text/html; charset=utf-8")


class SitemapXmlView(View):
    pages = (
        ("/", "weekly", "1.0"),
        ("/industrial-digitization/", "monthly", "0.7"),
    )

    def get(self, request, *args, **kwargs):
        today = date.today().isoformat()
        urls = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ]
        for path, changefreq, priority in self.pages:
            urls.extend(
                [
                    "  <url>",
                    f"    <loc>{escape(site_url(path))}</loc>",
                    f"    <lastmod>{today}</lastmod>",
                    f"    <changefreq>{changefreq}</changefreq>",
                    f"    <priority>{priority}</priority>",
                    "  </url>",
                ]
            )
        urls.append("</urlset>")
        return HttpResponse("\n".join(urls), content_type="application/xml; charset=utf-8")
