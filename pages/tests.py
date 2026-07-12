from django.test import SimpleTestCase, override_settings
from django.urls import reverse


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

    def test_industrial_placeholder_renders(self):
        response = self.client.get(reverse("pages:industrial-digitization"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Промышленная оцифровка")

    def test_service_login_placeholder_renders(self):
        response = self.client.get(reverse("pages:service-login"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Вход в кабинет")
        self.assertContains(response, '<meta name="robots" content="noindex,nofollow">')

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
