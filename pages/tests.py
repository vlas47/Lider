from django.test import SimpleTestCase, override_settings
from django.urls import reverse
from django.test import TestCase, Client
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage
from tempfile import TemporaryDirectory
from unittest.mock import patch

from .models import WebsiteRequest
from .site_services import SITE_SERVICES


class PublicSiteTests(SimpleTestCase):
    def test_home_page_renders(self):
        response = self.client.get(reverse("pages:home"))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "pages/home.html")
        self.assertContains(response, "lapin-home-config")
        self.assertContains(response, '<meta name="description"')
        self.assertContains(response, '<link rel="canonical" href="https://liderscan.ru/">')
        self.assertContains(response, '<meta property="og:title"')
        self.assertContains(response, 'application/ld+json')
        self.assertContains(response, "/static/img/license-fsb-2019.png")
        self.assertContains(response, "Сайты")
        self.assertContains(response, reverse("pages:sites"))
        self.assertContains(response, '"sites": "/sites/"')

    def test_sites_catalog_renders_all_site_types(self):
        response = self.client.get(reverse("pages:sites"))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "pages/sites.html")
        self.assertContains(response, "начинается рост.")
        self.assertContains(response, "Лендинг")
        self.assertContains(response, "Корпоративный сайт")
        self.assertContains(response, "Сайт-каталог")
        self.assertContains(response, "Поддержка сайта")
        self.assertContains(response, "Сайт-визитка")
        self.assertContains(response, "Интернет-магазин")
        self.assertContains(response, "Готовые сайты для бизнеса")
        self.assertContains(response, "Веб-сервисы и интернет-проекты")

    def test_site_service_page_renders(self):
        response = self.client.get(
            reverse("pages:site-service", kwargs={"slug": "online-store"})
        )

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "pages/site_service.html")
        self.assertContains(response, "Интернет-магазин")
        self.assertContains(response, "Каталог, корзина, оформление заказов")
        self.assertContains(response, "Что входит в работу")
        self.assertContains(response, "Обсудить проект")

    def test_unknown_site_service_returns_404(self):
        response = self.client.get(
            reverse("pages:site-service", kwargs={"slug": "unknown-site"})
        )

        self.assertEqual(response.status_code, 404)

    def test_industrial_placeholder_renders(self):
        response = self.client.get(reverse("pages:industrial-digitization"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Промышленная оцифровка")

    def test_service_login_redirects_to_ai_lapin(self):
        response = self.client.get(reverse("pages:service-login"))

        self.assertRedirects(
            response,
            "/ai-lapin/",
            status_code=301,
            fetch_redirect_response=False,
        )

    def test_robots_txt_renders(self):
        response = self.client.get(reverse("pages:robots"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertContains(response, "Disallow: /service/")
        self.assertContains(response, "Sitemap: https://liderscan.ru/sitemap.xml")

    def test_sitemap_xml_renders(self):
        response = self.client.get(reverse("pages:sitemap"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml; charset=utf-8")
        self.assertContains(response, "<loc>https://liderscan.ru/</loc>")
        self.assertContains(response, "<loc>https://liderscan.ru/sites/</loc>")
        self.assertContains(response, "<loc>https://liderscan.ru/sites/online-store/</loc>")
        self.assertContains(response, "<loc>https://liderscan.ru/industrial-digitization/</loc>")

    def test_favicon_redirects_to_static_icon(self):
        response = self.client.get(reverse("pages:favicon"))

        self.assertEqual(response.status_code, 301)
        self.assertEqual(response["Location"], "/static/img/favicon-32.png")

    def test_google_site_verification_file_renders(self):
        response = self.client.get(reverse("pages:google-site-verification"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
        self.assertContains(
            response,
            "google-site-verification: google5c5d79fc4edf432f.html",
        )

    def test_yandex_site_verification_file_renders(self):
        response = self.client.get(reverse("pages:yandex-site-verification"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")
        self.assertContains(response, "Verification: 3b68de66631d6409")

    @override_settings(ALLOWED_HOSTS=["testserver", "liderscan.ru", "www.liderscan.ru"])
    def test_www_redirects_to_canonical_host(self):
        response = self.client.get("/", HTTP_HOST="www.liderscan.ru")

        self.assertEqual(response.status_code, 301)
        self.assertEqual(response["Location"], "https://liderscan.ru/")


class WebsiteRequestTests(TestCase):
    def setUp(self):
        self.url = reverse("pages:site-service", kwargs={"slug": "site-support"})
        self.payload = {"name": "Тестовая компания", "phone": "+7 000 000-00-00", "email": "qa@example.test", "comment": "Проверка формы", "consent": "on"}
        self.files = TemporaryDirectory()
        self.addCleanup(self.files.cleanup)
        storage_patch = patch.object(WebsiteRequest._meta.get_field("brief"), "storage", FileSystemStorage(self.files.name))
        storage_patch.start()
        self.addCleanup(storage_patch.stop)

    def test_all_formats_have_matching_image_and_form(self):
        for service in SITE_SERVICES:
            with self.subTest(slug=service["slug"]):
                response = self.client.get(reverse("pages:site-service", kwargs={"slug": service["slug"]}))
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, service["image"])
                self.assertContains(response, service["request_title"])
                self.assertContains(response, 'enctype="multipart/form-data"')

    def test_valid_request_is_saved_once_and_confirmation_is_one_time(self):
        response = self.client.post(self.url, self.payload)
        self.assertEqual(response.status_code, 302)
        saved = WebsiteRequest.objects.get()
        self.assertEqual(saved.service_slug, "site-support")
        self.assertEqual(saved.phone, self.payload["phone"])
        self.assertEqual(saved.source_url, self.url)
        self.assertContains(self.client.get(response.url), "Спасибо, заявка принята")
        self.assertNotContains(self.client.get(response.url), "Спасибо, заявка принята")
        self.assertContains(self.client.post(self.url, self.payload), "через 30 секунд")
        self.assertEqual(WebsiteRequest.objects.count(), 1)

    def test_invalid_requests_are_not_saved(self):
        for change in ({"phone": "123"}, {"consent": ""}, {"email": "invalid"}, {"website": "spam"}, {"comment": "x" * 5001}):
            with self.subTest(change=list(change)):
                response = self.client.post(self.url, {**self.payload, **change})
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.context["request_form"].errors)
        self.assertFalse(WebsiteRequest.objects.exists())

    def test_upload_rejects_executable_and_wrong_signature(self):
        for name, content in (("brief.exe", b"MZcode"), ("brief.pdf", b"not a pdf")):
            response = self.client.post(self.url, {**self.payload, "brief": SimpleUploadedFile(name, content)})
            self.assertIn("brief", response.context["request_form"].errors)
        self.assertFalse(WebsiteRequest.objects.exists())

    def test_brief_is_private_and_can_be_downloaded_by_admin(self):
        content = b"%PDF-1.4\nLocal QA brief\n%%EOF"
        self.client.post(self.url, {**self.payload, "brief": SimpleUploadedFile("brief.pdf", content)})
        saved = WebsiteRequest.objects.get()
        self.assertTrue(saved.brief.storage.exists(saved.brief.name))
        download_url = reverse("admin:pages_websiterequest_brief", args=[saved.pk])
        self.assertEqual(self.client.get(download_url).status_code, 302)
        user = get_user_model().objects.create_superuser("qa-admin", "admin@example.test", "local-test-password")
        self.client.force_login(user)
        response = self.client.get(download_url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertEqual(b"".join(response.streaming_content), content)

    def test_csrf_is_required(self):
        response = Client(enforce_csrf_checks=True).post(self.url, self.payload)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(WebsiteRequest.objects.exists())

    def test_oversize_brief_is_rejected(self):
        brief = SimpleUploadedFile("large.pdf", b"%PDF" + b"x" * (10 * 1024 * 1024))
        response = self.client.post(self.url, {**self.payload, "brief": brief})
        self.assertIn("brief", response.context["request_form"].errors)
        self.assertFalse(WebsiteRequest.objects.exists())

    def test_staff_without_request_permission_cannot_download_brief(self):
        self.client.post(self.url, {**self.payload, "brief": SimpleUploadedFile("brief.pdf", b"%PDF-1.4\n%%EOF")})
        user = get_user_model().objects.create_user("qa-staff", is_staff=True)
        self.client.force_login(user)
        response = self.client.get(reverse("admin:pages_websiterequest_brief", args=[WebsiteRequest.objects.get().pk]))
        self.assertEqual(response.status_code, 403)
