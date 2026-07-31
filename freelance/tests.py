import json
from unittest.mock import AsyncMock, MagicMock, patch

from django.test import TestCase, override_settings
from django.urls import reverse

from leads.models import Lead
from profi.models import ProfiLead

from .models import FreelanceLead
from .server_browser import FREELANCE_ORDER_EXTRACTOR_SCRIPT, FreelanceServerBrowser


class FakeLocator:
    def __init__(self, count=0):
        self._count = count

    async def count(self):
        return self._count


class FreelanceRadarTests(TestCase):
    def test_logged_in_user_can_open_freelance_server(self):
        self.client.post(
            reverse("auth-login"),
            data=json.dumps({"password": "123"}),
            content_type="application/json",
        )

        response = self.client.get(reverse("freelance:server-api"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.json())
        self.assertIn("leads", response.json())

    @override_settings(DEBUG=True, OPENAI_API_KEY="", AI_LAPIN_DESKTOP_TOKEN="")
    def test_local_api_creates_only_freelance_lead(self):
        response = self.client.post(
            reverse("freelance:leads-api"),
            data=json.dumps(
                {
                    "text": "Нужна CRM для интернет-магазина и интеграция с 1С.",
                    "source_url": "https://freelance.ru/projects/example.html",
                    "source_id": "example-1",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Lead.objects.count(), 1)
        self.assertEqual(FreelanceLead.objects.count(), 1)
        self.assertEqual(ProfiLead.objects.count(), 0)
        self.assertEqual(response.json()["lead"]["source"], Lead.SOURCE_FREELANCE)

    def test_server_url_rejects_foreign_domain(self):
        from .server_browser import server_browser

        self.assertEqual(
            server_browser.clean_url("https://example.com/orders"),
            "https://freelance.ru/task?q=&c%5B%5D=4&a=1&v=1",
        )

    def test_extractor_targets_only_real_task_cards(self):
        self.assertIn('document.querySelectorAll("main article")', FREELANCE_ORDER_EXTRACTOR_SCRIPT)
        self.assertIn(r"^\/task\/view\/\d+\/?$", FREELANCE_ORDER_EXTRACTOR_SCRIPT)
        self.assertNotIn("hintPattern", FREELANCE_ORDER_EXTRACTOR_SCRIPT)

    def test_web_development_filter_is_required(self):
        browser = object.__new__(FreelanceServerBrowser)
        browser._page = MagicMock()

        browser._page.url = "https://freelance.ru/task?q=&c%5B%5D=4&a=1&v=1"
        self.assertTrue(browser._task_filter_is_selected())

        browser._page.url = "https://freelance.ru/task"
        self.assertFalse(browser._task_filter_is_selected())

        browser._page.url = "https://freelance.ru/task?c%5B%5D=4&c%5B%5D=5"
        self.assertFalse(browser._task_filter_is_selected())

    def test_selected_filter_url_does_not_click_checkbox_again(self):
        import asyncio

        browser = object.__new__(FreelanceServerBrowser)
        browser._page = MagicMock()
        browser._page.url = "https://freelance.ru/task?q=&c%5B%5D=4&a=1&v=1"
        browser.default_url = browser._page.url

        asyncio.run(browser._ensure_task_filter())

        browser._page.goto.assert_not_called()
        browser._page.get_by_role.assert_not_called()

    def test_login_required_on_identity_host(self):
        browser = object.__new__(FreelanceServerBrowser)
        browser._page = MagicMock()
        browser._page.url = "https://id.freelance.ru/login"

        import asyncio

        self.assertTrue(asyncio.run(browser._login_is_required()))

    def test_login_required_when_guest_link_is_visible(self):
        browser = object.__new__(FreelanceServerBrowser)
        browser._page = MagicMock()
        browser._page.url = "https://freelance.ru/project/search"
        browser._page.locator.return_value = FakeLocator(count=1)
        import asyncio

        self.assertTrue(asyncio.run(browser._login_is_required()))

    @override_settings(FREELANCE_LOGIN="", FREELANCE_PASSWORD="")
    @patch("leads.server_browser.PlatformServerBrowser._ensure_page", new_callable=AsyncMock)
    def test_empty_credentials_do_not_trigger_login(self, base_ensure_page):
        import asyncio

        base_ensure_page.return_value = True
        browser = object.__new__(FreelanceServerBrowser)
        browser._login_is_required = AsyncMock(return_value=True)
        browser._login = AsyncMock()
        browser._ensure_task_filter = AsyncMock()

        self.assertTrue(asyncio.run(browser._ensure_page()))
        browser._login.assert_not_awaited()
        browser._ensure_task_filter.assert_awaited_once()
