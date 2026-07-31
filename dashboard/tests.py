import json
from unittest.mock import patch

from django.test import override_settings
from django.test import TestCase
from django.urls import reverse

from profi.models import ProfiLead
from leads.scoring import analyze_profi_text, build_openai_analysis


class ProfiRadarTests(TestCase):
    @override_settings(OPENAI_API_KEY="")
    def test_landing_lead_gets_small_positive_signal(self):
        result = analyze_profi_text(
            "Нужен лендинг для услуги, небольшой корпоративный сайт-визитка. "
            "Есть тексты, нужно быстро собрать страницу и форму заявки. Бюджет до 30000 руб."
        )

        reasons = "\n".join(result["reasons"]).lower()
        self.assertIn("маленькая быстрая сайт-задача", reasons)
        self.assertNotIn("минус: простая лендинговая задача", reasons)
        self.assertNotIn("бюджетный ориентир", reasons)
        self.assertGreaterEqual(result["score"], 20)

    @override_settings(OPENAI_API_KEY="")
    def test_generic_web_development_site_lead_gets_review_score(self):
        result = analyze_profi_text(
            "Веб-разработка, сделать сайт или несколько сайтов до 50 000 ₽"
        )

        reasons = "\n".join(result["reasons"]).lower()
        self.assertIn("профильная веб-разработка", reasons)
        self.assertNotIn("бюджетный ориентир", reasons)
        self.assertGreaterEqual(result["score"], 38)
        self.assertEqual(result["status"], ProfiLead.STATUS_REVIEW)

    @override_settings(OPENAI_API_KEY="")
    def test_furniture_design_lead_gets_negative_signal(self):
        result = analyze_profi_text(
            "Нужно проектирование мебели, сделать чертежи мебели и раскрой шкафа."
        )

        reasons = "\n".join(result["reasons"]).lower()
        self.assertIn("минус: проектирование мебели", reasons)
        self.assertLess(result["score"], 20)

    @override_settings(OPENAI_API_KEY="")
    def test_company_ecommerce_with_figma_designs_gets_hot_score(self):
        result = analyze_profi_text(
            "Сайт компании. Функционал сайта: Интернет магазин B2C, блог. "
            "Контент есть. Будут готовые дизайны страниц в Фигме: auto layout, компоненты, дизайн-токены. "
            "Нужны главная, каталог, карточка товара, корзина и процесс покупки, информационная страница."
        )

        reasons = "\n".join(result["reasons"]).lower()
        self.assertIn("интернет-магазин", reasons)
        self.assertIn("полный e-commerce сценарий", reasons)
        self.assertIn("готовые макеты в figma", reasons)
        self.assertGreaterEqual(result["score"], 62)

    @override_settings(OPENAI_API_KEY="secret")
    def test_openai_analysis_cannot_lower_local_score(self):
        fallback = {
            "title": "Сайт компании",
            "budget_hint": "",
            "score": 66,
            "verdict": "Горячая заявка",
            "status": ProfiLead.STATUS_REVIEW,
            "reasons": ["интернет-магазин", "полный e-commerce сценарий"],
            "draft_reply": "",
        }
        response = {
            "choices": [
                {
                    "message": {
                        "content": json.dumps(
                            {
                                "title": "Сайт компании",
                                "budget_hint": "",
                                "score": 44,
                                "verdict": "Можно брать",
                                "status": "review",
                                "reasons": ["готовые макеты"],
                                "draft_reply": "Здравствуйте.",
                            },
                            ensure_ascii=False,
                        )
                    }
                }
            ]
        }

        with patch("leads.scoring.post_json", return_value=response):
            result = build_openai_analysis("Сайт компании B2C", fallback)

        self.assertEqual(result["score"], 66)
        self.assertIn("интернет-магазин", result["reasons"])

    def test_crm_lead_gets_review_verdict(self):
        result = analyze_profi_text(
            "Нужна CRM для заявок, складских остатков, ролей менеджеров и интеграции с 1С. "
            "Бюджет до 120 000 руб."
        )

        self.assertGreaterEqual(result["score"], 62)
        self.assertEqual(result["status"], ProfiLead.STATUS_REVIEW)
        self.assertIn("CRM", result["draft_reply"])

    def test_logged_in_user_can_add_profi_lead(self):
        self.client.post(
            reverse("auth-login"),
            data=json.dumps({"password": "123"}),
            content_type="application/json",
        )

        response = self.client.post(
            reverse("profi:leads-api"),
            data=json.dumps(
                {
                    "text": "Нужен личный кабинет клиента и интеграция оплаты для интернет-магазина.",
                    "source_url": "https://profi.ru/backoffice/order/123/",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        lead = ProfiLead.objects.get()
        self.assertEqual(lead.title, "Нужен личный кабинет клиента и интеграция оплаты для интернет-магазина.")
        self.assertTrue(lead.draft_reply)

    def test_logged_in_user_can_open_profi_radar(self):
        response = self.client.get(reverse("home"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '<div id="root"></div>')

    def test_logged_in_user_can_open_server_profi_radar(self):
        self.client.post(
            reverse("auth-login"),
            data=json.dumps({"password": "123"}),
            content_type="application/json",
        )

        response = self.client.get(reverse("profi:server-api"))

        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.json())
        self.assertIn("leads", response.json())

    @override_settings(DEBUG=True, AI_LAPIN_DESKTOP_TOKEN="")
    def test_local_desktop_api_can_create_profi_lead(self):
        response = self.client.post(
            reverse("profi-leads-api"),
            data=json.dumps(
                {
                    "text": "Нужна CRM для заявок, ролей менеджеров, отчетов и интеграции с 1С.",
                    "source_url": "https://profi.ru/backoffice/order/456/",
                    "client_hint": "Profi test",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["lead"]["client_hint"], "Profi test")
        self.assertGreaterEqual(payload["lead"]["score"], 38)

    @override_settings(DEBUG=False, AI_LAPIN_DESKTOP_TOKEN="secret-token")
    def test_desktop_api_requires_token_outside_debug(self):
        denied = self.client.get(reverse("profi-leads-api"))
        allowed = self.client.get(reverse("profi-leads-api"), HTTP_X_AI_LAPIN_TOKEN="secret-token")

        self.assertEqual(denied.status_code, 403)
        self.assertEqual(allowed.status_code, 200)
