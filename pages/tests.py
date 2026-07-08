from django.test import SimpleTestCase
from django.urls import reverse


class PublicSiteTests(SimpleTestCase):
    def test_home_page_renders(self):
        response = self.client.get(reverse("pages:home"))

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "pages/home.html")
        self.assertContains(response, "lapin-home-config")

    def test_industrial_placeholder_renders(self):
        response = self.client.get(reverse("pages:industrial-digitization"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Промышленная оцифровка")

    def test_service_login_placeholder_renders(self):
        response = self.client.get(reverse("pages:service-login"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Вход в кабинет")
