import sqlite3
import tempfile
import threading
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse

from .models import Lead
from .quick_replies import build_suggested_quick_reply
from .scoring import build_max_message
from .server_browser import PlatformServerBrowser


class LeadModelTests(TestCase):
    def test_corporate_lpmotor_reply_is_built_on_server(self):
        lead = Lead(
            source=Lead.SOURCE_PROFI,
            title="Корпоративный сайт (сайт компании)",
            raw_text="Платформа LPmotor. Контент есть. Нужны виджеты.",
            score=42,
            verdict="Можно брать",
        )

        reply = build_suggested_quick_reply(lead)

        self.assertEqual(reply["id"], "corporate")
        self.assertIn("LPmotor", reply["reply"])
        self.assertIn("контент уже подготовлен", reply["reply"])

    def test_crypto_store_reply_is_built_on_server(self):
        lead = Lead(
            source=Lead.SOURCE_FREELANCE,
            title="Интернет-магазин с крипто оплатой",
            raw_text="Нужен современный интернет магазин с оплатой криптовалютой.",
            score=54,
            verdict="Можно брать",
        )

        reply = build_suggested_quick_reply(lead)

        self.assertEqual(reply["id"], "ecommerce")
        self.assertIn("какие криптовалюты и сети", reply["reply"])

    def test_max_message_uses_server_quick_reply(self):
        lead = Lead(
            source=Lead.SOURCE_FREELANCE,
            title="Интернет-магазин с крипто оплатой",
            raw_text="Нужна оплата криптовалютой.",
            score=54,
            verdict="Можно брать",
            draft_reply="СТАРЫЙ ОБЩИЙ ОТВЕТ",
        )

        message = build_max_message(lead)

        self.assertIn("Быстрый ответ · Интернет-магазин", message)
        self.assertIn("оплатой криптовалютой", message)
        self.assertNotIn("СТАРЫЙ ОБЩИЙ ОТВЕТ", message)

    def test_health_checks_database(self):
        response = self.client.get(reverse("health"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "database": "ok"})

    def test_sources_share_one_table(self):
        Lead.objects.create(source=Lead.SOURCE_PROFI, title="P", raw_text="P")
        Lead.objects.create(source=Lead.SOURCE_FREELANCE, title="F", raw_text="F")

        self.assertEqual(Lead.objects.count(), 2)

    @override_settings(AI_LAPIN_PASSWORD="123")
    def test_screenshot_does_not_start_browser(self):
        self.client.post(
            reverse("auth-login"),
            data='{"password":"123"}',
            content_type="application/json",
        )

        response = self.client.get(reverse("profi:server-screenshot"))

        self.assertEqual(response.status_code, 409)

    def test_legacy_sqlite_import_is_idempotent(self):
        handle = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
        handle.close()
        path = Path(handle.name)
        self.addCleanup(path.unlink, missing_ok=True)
        with closing(sqlite3.connect(path)) as connection:
            connection.execute(
                """
                CREATE TABLE dashboard_profilead (
                    id INTEGER PRIMARY KEY,
                    title TEXT,
                    source_url TEXT,
                    raw_text TEXT,
                    client_hint TEXT,
                    budget_hint TEXT,
                    score INTEGER,
                    verdict TEXT,
                    ai_notes TEXT,
                    draft_reply TEXT,
                    status TEXT,
                    max_status TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
                """
            )
            connection.execute(
                """
                INSERT INTO dashboard_profilead VALUES
                (1, 'CRM', 'https://profi.ru/order/1', 'Нужна CRM', '', '', 70,
                 'Горячая заявка', '', 'Ответ', 'review', '',
                 '2026-07-01T10:00:00+00:00', '2026-07-01T11:00:00+00:00')
                """
            )
            connection.commit()

        call_command("import_legacy_sqlite", str(path))
        call_command("import_legacy_sqlite", str(path))

        lead = Lead.objects.get()
        self.assertEqual(lead.source, Lead.SOURCE_PROFI)
        self.assertEqual(lead.score, 70)


class MonitorRuntimeTests(TestCase):
    def test_catch_up_monitor_scans_instead_of_seeding_a_baseline(self):
        browser = object.__new__(PlatformServerBrowser)
        browser._lock = threading.RLock()
        browser._monitor_active = False
        browser._last_error = "old"
        browser.source_label = "Test.ru"
        browser.scan = MagicMock(return_value={"visible": 2})
        browser.status = MagicMock(return_value={"monitor_active": True})

        with patch("leads.server_browser.threading.Thread") as thread_class:
            result = browser.start_monitor(catch_up=True)

        browser.scan.assert_called_once_with(refresh=False, baseline=False)
        thread_class.return_value.start.assert_called_once_with()
        self.assertTrue(result["monitor_active"])

    def test_dedicated_runtime_starts_only_selected_platform(self):
        from .monitor_runtime import start_configured_monitor

        browser = MagicMock()
        module = SimpleNamespace(server_browser=browser)
        with (
            patch.dict("os.environ", {"AI_LAPIN_MONITOR_PLATFORM": "profi"}),
            patch("leads.monitor_runtime.atexit.register") as register,
            patch("leads.monitor_runtime.importlib.import_module", return_value=module) as importer,
        ):
            result = start_configured_monitor()

        importer.assert_called_once_with("profi.server_browser")
        browser.start.assert_called_once_with()
        browser.start_monitor.assert_called_once_with(catch_up=True)
        register.assert_called_once()
        self.assertIs(result, browser)
