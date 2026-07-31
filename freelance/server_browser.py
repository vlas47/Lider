from urllib.parse import parse_qs, urlparse

from django.conf import settings

from leads.server_browser import PlatformServerBrowser
from leads.services import create_freelance_lead_from_text

from .models import FreelanceLead


FREELANCE_ORDER_EXTRACTOR_SCRIPT = r"""
() => {
    const compactText = (node) => String(node?.innerText || node?.textContent || "")
        .replace(/\s+/g, " ")
        .trim();

    return Array.from(document.querySelectorAll("main article"))
        .map((article) => {
            const titleLink = Array.from(article.querySelectorAll("a[href]"))
                .find((link) => {
                    try {
                        return /^\/task\/view\/\d+\/?$/.test(new URL(link.href, location.origin).pathname);
                    } catch (_error) {
                        return false;
                    }
                });
            if (!titleLink) return null;

            const text = compactText(article);
            const title = compactText(titleLink);
            if (!text || !title) return null;
            return {text, url: titleLink.href, title};
        })
        .filter(Boolean)
        .slice(0, 12);
}
"""


class FreelanceServerBrowser(PlatformServerBrowser):
    login_url = "https://freelance.ru/auth/login"
    filter_category_id = "4"
    filter_category_label = "Веб-разработка и IT"

    async def _ensure_page(self):
        result = await super()._ensure_page()
        if settings.FREELANCE_LOGIN and settings.FREELANCE_PASSWORD:
            if await self._login_is_required():
                await self._login()
        await self._ensure_task_filter()
        return result

    def _task_filter_is_selected(self):
        parsed = urlparse(self._page.url)
        categories = parse_qs(parsed.query).get("c[]", [])
        return parsed.path.rstrip("/") == "/task" and categories == [self.filter_category_id]

    async def _ensure_task_filter(self):
        if self._task_filter_is_selected():
            return

        await self._page.goto(self.default_url, wait_until="domcontentloaded")
        if self._task_filter_is_selected():
            return

        checkbox = self._page.get_by_role(
            "checkbox",
            name=self.filter_category_label,
            exact=True,
        )
        try:
            if await checkbox.count():
                checkbox = checkbox.first
            if await checkbox.count() and not await checkbox.is_checked():
                await checkbox.check()
                apply_button = self._page.get_by_role(
                    "button",
                    name="Применить фильтры",
                    exact=True,
                )
                if await apply_button.count():
                    apply_button = apply_button.first
                await apply_button.click()
                await self._page.wait_for_load_state("domcontentloaded")
        except Exception as error:
            raise RuntimeError(
                "Freelance.ru: не удалось выбрать категорию «Веб-разработка и IT»."
            ) from error

        if not self._task_filter_is_selected():
            raise RuntimeError(
                "Freelance.ru не подтвердил фильтр «Веб-разработка и IT»."
            )

    async def _login_is_required(self):
        hostname = (urlparse(self._page.url).hostname or "").lower()
        if hostname == "id.freelance.ru":
            return True
        try:
            return await self._page.locator("a[href='/auth/login']").count() > 0
        except Exception:
            return False

    async def _login(self):
        await self._page.goto(self.login_url, wait_until="domcontentloaded")

        login_field = self._page.get_by_role("textbox", name="Логин или email", exact=True)
        password_field = self._page.get_by_role("textbox", name="Пароль", exact=True)
        submit_button = self._page.get_by_role("button", name="Войти", exact=True)
        try:
            await login_field.wait_for(state="visible", timeout=15000)
            await password_field.wait_for(state="visible", timeout=15000)
            await login_field.fill(settings.FREELANCE_LOGIN)
            await password_field.fill(settings.FREELANCE_PASSWORD)
            await submit_button.click()
            await self._page.wait_for_url(
                lambda url: (urlparse(str(url)).hostname or "").lower() in {"freelance.ru", "www.freelance.ru"},
                timeout=20000,
            )
        except Exception as error:
            raise RuntimeError(
                "Автоматический вход в Freelance.ru не выполнен. "
                "Проверьте пароль, CAPTCHA или запрос дополнительного подтверждения."
            ) from error

        if await self._login_is_required():
            raise RuntimeError("Freelance.ru не подтвердил автоматический вход.")

        await self._page.goto(self.default_url, wait_until="domcontentloaded")
        self._event("Freelance.ru: сессия восстановлена автоматически.")


server_browser = FreelanceServerBrowser(
    source_label="Freelance.ru",
    default_url=settings.FREELANCE_DEFAULT_URL,
    allowed_domains=("freelance.ru",),
    profile_dir=settings.FREELANCE_BROWSER_PROFILE_DIR,
    seen_path=settings.FREELANCE_SEEN_ORDERS_PATH,
    lead_model=FreelanceLead,
    lead_factory=create_freelance_lead_from_text,
    monitor_min_seconds=settings.FREELANCE_MONITOR_MIN_SECONDS,
    monitor_max_seconds=settings.FREELANCE_MONITOR_MAX_SECONDS,
    monitor_score_threshold=settings.FREELANCE_MONITOR_SCORE_THRESHOLD,
    extractor_script=FREELANCE_ORDER_EXTRACTOR_SCRIPT,
)
