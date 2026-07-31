import asyncio
import json
import random
import re
import threading
import time
from dataclasses import dataclass, field
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

from .services import send_max_event, send_max_text


PROFI_MOBILE_USER_AGENT = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
)
PROFI_VISIBLE_SCAN_LIMIT = 5

ORDER_EXTRACTOR_SCRIPT = r"""
() => {
    const hintPattern = /(руб|₽|дистанционно|заказ|заявк|нужн|сайт|прилож|crm|срм|интеграц|кабинет|магазин|автоматизац|доработ|настро|бот|парсер|api|1с|python|django|react)/i;
    const textOf = (node) => String(node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
    const nodes = Array.from(document.querySelectorAll("article, a[href], li, [role='listitem'], section, div"));
    const raw = [];

    for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.width < 220 || rect.height < 44 || rect.height > 760) continue;
        if (rect.bottom < -80 || rect.top > window.innerHeight + 320) continue;

        const text = textOf(node);
        if (text.length < 70 || text.length > 1800) continue;
        if (!hintPattern.test(text)) continue;

        const linkNode = node.matches("a[href]")
            ? node
            : node.querySelector("a[href]") || node.closest("a[href]") || node.parentElement?.closest?.("a[href]");
        raw.push({
            text,
            url: linkNode ? linkNode.href : location.href,
            title: text.slice(0, 180),
            top: Math.round(rect.top),
            length: text.length
        });
    }

    const compact = [];
    raw.sort((a, b) => a.length - b.length);
    for (const item of raw) {
        const sample = item.text.slice(0, 95).toLowerCase();
        if (compact.some((existing) => existing.text.toLowerCase().includes(sample) || sample.includes(existing.text.slice(0, 95).toLowerCase()))) {
            continue;
        }
        compact.push(item);
    }

    return compact
        .sort((a, b) => a.top - b.top)
        .slice(0, 12)
        .map(({ text, url, title }) => ({ text, url, title }));
}
"""


@dataclass
class MonitorEvent:
    message: str
    kind: str = ""
    created_at: str = field(default_factory=lambda: timezone.localtime().strftime("%H:%M:%S"))

    def as_dict(self):
        return {"message": self.message, "kind": self.kind, "created_at": self.created_at}


class PlatformServerBrowser:
    def __init__(
        self,
        *,
        source_label,
        default_url,
        allowed_domains,
        profile_dir,
        seen_path,
        lead_model,
        lead_factory,
        monitor_min_seconds,
        monitor_max_seconds,
        monitor_score_threshold,
        extractor_script=ORDER_EXTRACTOR_SCRIPT,
    ):
        self._loop = None
        self._loop_thread = None
        self._playwright = None
        self._context = None
        self._page = None
        self._lock = threading.RLock()
        self._events = []
        self._seen_keys = set()
        self._monitor_active = False
        self._monitor_thread = None
        self._next_scan_at = ""
        self._last_scan_at = ""
        self._last_scan_summary = ""
        self._last_error = ""
        self._last_problem_key = ""
        self._last_problem_at = None
        self._previous_visible_keys = []
        self.source_label = source_label
        self.default_url = default_url
        self.allowed_domains = tuple(allowed_domains)
        self._profile_dir = Path(profile_dir)
        self._seen_path = Path(seen_path)
        self._lead_model = lead_model
        self._lead_factory = lead_factory
        self._monitor_min_seconds = int(monitor_min_seconds)
        self._monitor_max_seconds = int(monitor_max_seconds)
        self._monitor_score_threshold = int(monitor_score_threshold)
        self._extractor_script = extractor_script

    def status(self):
        with self._lock:
            url = ""
            title = ""
            if self._page:
                try:
                    url = self.run(self._get_url())
                    title = self.run(self._get_title())
                except Exception as error:
                    if not self._is_transient_page_error(error):
                        self._last_error = str(error)
            return {
                "started": bool(self._page),
                "url": url,
                "title": title,
                "monitor_active": self._monitor_active,
                "next_scan_at": self._next_scan_at,
                "last_scan_at": self._last_scan_at,
                "last_scan_summary": self._last_scan_summary,
                "last_error": self._last_error,
                "events": [event.as_dict() for event in self._events[-6:]][::-1],
            }

    def _is_transient_page_error(self, error):
        message = str(error).lower()
        transient_fragments = (
            "execution context was destroyed",
            "most likely because of a navigation",
            "navigation",
            "target closed",
        )
        return any(fragment in message for fragment in transient_fragments)

    def start(self):
        return self.run(self._ensure_page())

    def stop(self):
        self.stop_monitor()
        if self._loop and (self._page or self._context or self._playwright):
            self.run(self._shutdown_browser())
        self._event(f"Серверный браузер {self.source_label} остановлен.")
        return self.status()

    def screenshot(self):
        return self.run(self._screenshot())

    def goto(self, url):
        url = self.clean_url(url)
        self.run(self._goto(url))
        return self.status()

    def reload(self):
        self.run(self._reload())
        return self.status()

    def back(self):
        self.run(self._back())
        return self.status()

    def click(self, x, y):
        self.run(self._click(float(x), float(y)))
        return self.status()

    def type_text(self, text):
        self.run(self._type_text(text))
        return self.status()

    def press(self, key):
        self.run(self._press(key))
        return self.status()

    def scroll(self, delta_y):
        self.run(self._scroll(float(delta_y)))
        return self.status()

    def _scan_legacy(self, baseline=False, refresh=False, threshold=None, force=False):
        close_old_connections()
        try:
            if refresh:
                self.run(self._reload())
                time.sleep(1.2)
            orders = self.run(self._extract_orders())
            if baseline:
                for order in orders:
                    self._remember(order)
                self._event(f"База готова: вижу {len(orders)} карточек. Жду новые.")
                return {"orders": len(orders), "fresh": 0, "leads": []}

            unique_orders = self._dedupe_orders(orders)
            fresh = unique_orders[:4] if force else [order for order in unique_orders if self._key(order) not in self._seen_keys]
            leads = []
            created = 0
            emitted_lead_ids = set()
            threshold = self._monitor_score_threshold if threshold is None else int(threshold)
            for order in fresh[:4]:
                self._remember(order)
                lead = self._find_existing_lead(order)
                if lead:
                    if lead.id in emitted_lead_ids:
                        continue
                    emitted_lead_ids.add(lead.id)
                    leads.append(self.serialize_lead(lead))
                    continue

                lead = self._lead_factory(order["text"], source_url=order.get("url", ""), client_hint=f"VPS {self.source_label} Radar")
                created += 1
                emitted_lead_ids.add(lead.id)
                leads.append(self.serialize_lead(lead))
                if lead.score >= threshold:
                    result = send_max_event(lead)
                    lead.refresh_from_db()
                    self._event(f"Интересная заявка {lead.score}/100: {lead.title}. {result}", "hot")
                else:
                    self._event(f"Новая заявка {lead.score}/100: {lead.title}")
            with self._lock:
                self._last_scan_at = timezone.localtime().strftime("%H:%M:%S")
            return {"orders": len(unique_orders), "fresh": len(fresh), "analyzed": len(fresh[:4]), "created": created, "leads": leads}
        finally:
            close_old_connections()

    def scan(self, baseline=False, refresh=False, threshold=None, force=False):
        close_old_connections()
        try:
            if refresh:
                self.run(self._reload())
                time.sleep(1.2)

            orders = self.run(self._extract_orders())
            unique_orders = self._dedupe_orders(orders)
            visible_orders = unique_orders[:PROFI_VISIBLE_SCAN_LIMIT]
            visible_keys = [self._key(order) for order in visible_orders]

            if not visible_orders:
                problem = self.run(self._detect_problem_state())
                summary = problem or f"Скан: верхних заявок не видно. Проверь, что открыт раздел заказов {self.source_label}."
                if problem:
                    self._notify_problem_once(problem, "login_required")
                self._set_scan_state(summary, visible_keys)
                self._event(summary, "error" if problem else "")
                return {
                    "orders": 0,
                    "visible": 0,
                    "fresh": 0,
                    "analyzed": 0,
                    "created": 0,
                    "existing": 0,
                    "updated": 0,
                    "max_sent": 0,
                    "summary": summary,
                    "leads": [],
                }

            if baseline:
                for order in visible_orders:
                    self._remember(order)
                    lead = self._find_existing_lead(order)
                    if lead:
                        self._touch_lead(lead, order)
                summary = f"База готова: запомнил верхние {len(visible_orders)} заявок. Дальше ловлю только изменения в верхней пятерке."
                self._set_scan_state(summary, visible_keys)
                self._event(summary)
                return {
                    "orders": len(unique_orders),
                    "visible": len(visible_orders),
                    "fresh": 0,
                    "analyzed": 0,
                    "created": 0,
                    "existing": 0,
                    "updated": 0,
                    "max_sent": 0,
                    "summary": summary,
                    "leads": [],
                }

            with self._lock:
                previous_visible_keys = set(self._previous_visible_keys)

            if force or not previous_visible_keys:
                fresh_orders = visible_orders
            else:
                fresh_orders = [
                    order
                    for order, key in zip(visible_orders, visible_keys)
                    if key and key not in previous_visible_keys
                ]

            leads = []
            created = 0
            existing = 0
            updated = 0
            max_sent = 0
            emitted_lead_ids = set()
            threshold = self._monitor_score_threshold if threshold is None else int(threshold)

            for order in visible_orders:
                lead = self._find_existing_lead(order)
                if lead:
                    existing += 1
                    self._touch_lead(lead, order)
                    updated += 1

            for order in fresh_orders[:PROFI_VISIBLE_SCAN_LIMIT]:
                self._remember(order)
                lead = self._find_existing_lead(order)
                created_now = False
                if lead:
                    self._touch_lead(lead, order)
                else:
                    lead = self._lead_factory(order["text"], source_url=order.get("url", ""), client_hint=f"VPS {self.source_label} Radar")
                    created += 1
                    created_now = True

                if lead.id not in emitted_lead_ids:
                    emitted_lead_ids.add(lead.id)
                    leads.append(self.serialize_lead(lead))

                if lead.score >= threshold and not lead.max_status:
                    result = send_max_event(lead)
                    max_sent += 1
                    lead.refresh_from_db()
                    self._event(f"Интересная заявка {lead.score}/100: {lead.title}. {result}", "hot")
                elif created_now:
                    self._event(f"Новая заявка {lead.score}/100: {lead.title}")

            summary = (
                f"Скан: верхних заявок {len(visible_orders)}, новых в верхней пятерке {len(fresh_orders)}, "
                f"разобрано {len(fresh_orders[:PROFI_VISIBLE_SCAN_LIMIT])}, создано {created}, обновлено {updated}."
            )
            self._set_scan_state(summary, visible_keys)
            if not fresh_orders:
                self._event("Новых карточек в верхней пятерке нет.")
            return {
                "orders": len(unique_orders),
                "visible": len(visible_orders),
                "fresh": len(fresh_orders),
                "analyzed": len(fresh_orders[:PROFI_VISIBLE_SCAN_LIMIT]),
                "created": created,
                "existing": existing,
                "updated": updated,
                "max_sent": max_sent,
                "summary": summary,
                "leads": leads,
            }
        finally:
            close_old_connections()

    def start_monitor(self):
        with self._lock:
            if self._monitor_active:
                return self.status()
            self._monitor_active = True
            self._last_error = ""

        result = self.scan(refresh=False, baseline=True)
        if not result.get("visible"):
            self._event("Видимых заявок для разбора пока нет.")
        thread_name = f"{self.source_label.lower()}-server-monitor".replace(".ru", "")
        self._monitor_thread = threading.Thread(target=self._monitor_loop, name=thread_name, daemon=True)
        self._monitor_thread.start()
        return self.status()

    def stop_monitor(self):
        with self._lock:
            self._monitor_active = False
            self._next_scan_at = ""
        self._event("Наблюдение остановлено.")
        return self.status()

    def clean_url(self, value):
        candidate = (value or self.default_url).strip()
        parsed = urlparse(candidate)
        if parsed.scheme not in {"https", "http"}:
            return self.default_url
        hostname = parsed.hostname or ""
        if any(hostname == domain or hostname.endswith(f".{domain}") for domain in self.allowed_domains):
            return candidate
        return self.default_url

    clean_profi_url = clean_url

    def run(self, coro):
        self._ensure_loop()
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=45)

    def _ensure_loop(self):
        if self._loop:
            return
        with self._lock:
            if self._loop:
                return
            self._loop = asyncio.new_event_loop()
            thread_name = f"{self.source_label.lower()}-browser-loop".replace(".ru", "")
            self._loop_thread = threading.Thread(target=self._run_loop, name=thread_name, daemon=True)
            self._loop_thread.start()

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    async def _ensure_page(self):
        if self._page:
            return True

        try:
            from playwright.async_api import async_playwright
        except ImportError as error:
            raise RuntimeError("Playwright не установлен. Выполни: pip install playwright && python -m playwright install chromium") from error

        self._profile_dir.mkdir(parents=True, exist_ok=True)
        self._load_seen()
        self._playwright = await async_playwright().start()
        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(self._profile_dir),
            headless=True,
            viewport={"width": 390, "height": 844},
            device_scale_factor=1,
            is_mobile=True,
            has_touch=True,
            user_agent=PROFI_MOBILE_USER_AGENT,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        )
        self._context.on("page", self._handle_new_page)
        self._page = self._context.pages[0] if self._context.pages else await self._context.new_page()
        self._page.set_default_timeout(15000)
        if not self._page.url or self._page.url == "about:blank":
            await self._page.goto(self.default_url, wait_until="domcontentloaded")
        self._event(f"Серверный браузер {self.source_label} запущен.")
        return True

    async def _shutdown_browser(self):
        context, playwright = self._context, self._playwright
        self._page = None
        self._context = None
        self._playwright = None
        if context:
            await context.close()
        if playwright:
            await playwright.stop()

    def _handle_new_page(self, page):
        self._page = page
        self._page.set_default_timeout(15000)
        self._event(f"Открыта новая вкладка {self.source_label}.")

    async def _get_url(self):
        await self._ensure_page()
        return self._page.url

    async def _get_title(self):
        await self._ensure_page()
        return await self._page.title()

    async def _screenshot(self):
        await self._ensure_page()
        return await self._page.screenshot(type="png", full_page=False)

    async def _goto(self, url):
        await self._ensure_page()
        await self._page.goto(url, wait_until="domcontentloaded")

    async def _reload(self):
        await self._ensure_page()
        await self._page.reload(wait_until="domcontentloaded")

    async def _back(self):
        await self._ensure_page()
        await self._page.go_back(wait_until="domcontentloaded")

    async def _click(self, x, y):
        await self._ensure_page()
        await self._page.mouse.click(x, y)

    async def _type_text(self, text):
        await self._ensure_page()
        await self._page.keyboard.type(text, delay=20)

    async def _press(self, key):
        await self._ensure_page()
        await self._page.keyboard.press(key)

    async def _scroll(self, delta_y):
        await self._ensure_page()
        await self._page.mouse.wheel(0, delta_y)

    async def _extract_orders(self):
        await self._ensure_page()
        try:
            await self._page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            pass

        for delay in (0, 800, 1600):
            if delay:
                await self._page.wait_for_timeout(delay)
            orders = await self._page.evaluate(self._extractor_script)
            if orders:
                return orders
        return []

    async def _detect_problem_state(self):
        await self._ensure_page()
        try:
            title = await self._page.title()
        except Exception:
            title = ""
        try:
            body_text = await self._page.evaluate("() => document.body ? document.body.innerText : ''")
        except Exception:
            body_text = ""

        text = re.sub(r"\s+", " ", f"{title} {body_text}").lower()
        login_markers = (
            "вход и регистрация",
            "логин или телефон",
            "войти по смс",
            "войдите",
            "продолжить",
        )
        source_marker = self.source_label.lower().replace(".ru", "")
        if source_marker in text and any(marker in text for marker in login_markers):
            return f"{self.source_label} Radar: кабинет просит вход. Открой приложение и авторизуйся, чтобы монитор продолжил работу."
        return ""

    def _monitor_loop(self):
        while True:
            with self._lock:
                if not self._monitor_active:
                    return
            delay = random.randint(self._monitor_min_seconds, self._monitor_max_seconds)
            next_time = timezone.localtime(timezone.now() + timedelta(seconds=delay)).strftime("%H:%M:%S")
            with self._lock:
                self._next_scan_at = next_time
            self._event(f"Следующая проверка в {next_time} ({delay} сек).")

            for _ in range(delay):
                with self._lock:
                    if not self._monitor_active:
                        return
                time.sleep(1)

            try:
                self.scan(refresh=True)
            except Exception as error:
                with self._lock:
                    self._last_error = str(error)
                self._event(f"Ошибка скана: {error}", "error")
                self._notify_problem_once(
                    f"{self.source_label} Radar: ошибка скана. Открой приложение и проверь кабинет. Детали: {error}",
                    "scan_error",
                )

    def _key(self, order):
        return self._fingerprint(order.get("text", ""))

    def _dedupe_orders(self, orders):
        result = []
        for order in orders:
            text = order.get("text", "")
            if not text:
                continue
            if any(self._is_same_order_text(text, existing.get("text", "")) for existing in result):
                continue
            result.append(order)
        return result

    def _set_scan_state(self, summary, visible_keys):
        with self._lock:
            self._last_scan_at = timezone.localtime().strftime("%H:%M:%S")
            self._last_scan_summary = summary
            self._previous_visible_keys = [key for key in visible_keys if key]

    def _touch_lead(self, lead, order):
        update_fields = ["updated_at"]
        raw_text = (order.get("text") or "").strip()
        source_url = (order.get("url") or "").strip()
        if raw_text and raw_text != lead.raw_text and len(raw_text) >= len(lead.raw_text or ""):
            lead.raw_text = raw_text
            update_fields.append("raw_text")
        if source_url and source_url != lead.source_url:
            lead.source_url = source_url
            update_fields.append("source_url")
        lead.updated_at = timezone.now()
        lead.save(update_fields=update_fields)
        return lead

    def _notify_problem_once(self, message, key):
        now = timezone.now()
        with self._lock:
            should_send = (
                self._last_problem_key != key
                or not self._last_problem_at
                or now - self._last_problem_at > timedelta(minutes=30)
            )
            if should_send:
                self._last_problem_key = key
                self._last_problem_at = now
        if not should_send:
            return "MAX уже уведомлен недавно"
        result = send_max_text(message)
        self._event(f"{message} MAX: {result}", "error")
        return result

    def _find_existing_lead(self, order):
        raw_text = order.get("text", "")
        lead = self._lead_model.objects.filter(raw_text=raw_text).order_by("-created_at").first()
        if lead:
            return lead

        fingerprint = self._fingerprint(raw_text)
        if not fingerprint:
            return None
        for candidate in self._lead_model.objects.order_by("-updated_at", "-created_at")[:80]:
            if self._fingerprint(candidate.raw_text) == fingerprint or self._is_same_order_text(raw_text, candidate.raw_text):
                return candidate
        return None

    def _fingerprint(self, text):
        normalized = re.sub(r"\s+", " ", (text or "").lower())
        normalized = re.sub(r"\b\d+\s*(минут[а-я]*|час[а-я]*|дн[а-я]*)\s*назад\b", " ", normalized)
        normalized = re.sub(r"\bfalse\b", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        if not normalized:
            return ""

        money = re.search(r"(?:до|от)?\s*\d[\d\s]{0,8}\s*(?:₽|руб)", normalized)
        budget = re.sub(r"\s+", "", money.group(0)) if money else ""
        words = re.findall(r"[a-zа-яё0-9]+", normalized)
        meaningful = [
            word for word in words
            if word not in {"назад", "false", "дистанционно", "москва", "санкт", "петербург"}
        ]
        return f"{budget}|{' '.join(meaningful[:18])}"

    def _is_same_order_text(self, first, second):
        first_normal = self._normal_text(first)
        second_normal = self._normal_text(second)
        if not first_normal or not second_normal:
            return False
        if first_normal == second_normal:
            return True
        if len(first_normal) > 80 and len(second_normal) > 80:
            shorter, longer = sorted([first_normal, second_normal], key=len)
            if shorter in longer:
                return True

        first_budget = self._budget_key(first_normal)
        second_budget = self._budget_key(second_normal)
        if first_budget and second_budget and first_budget != second_budget:
            return False

        first_tokens = self._important_tokens(first_normal)
        second_tokens = self._important_tokens(second_normal)
        if len(first_tokens) < 5 or len(second_tokens) < 5:
            return False
        overlap = len(first_tokens & second_tokens) / min(len(first_tokens), len(second_tokens))
        required = 0.68 if first_budget or second_budget else 0.82
        return overlap >= required

    def _normal_text(self, text):
        normalized = re.sub(r"\s+", " ", (text or "").lower())
        normalized = re.sub(r"\b\d+\s*(минут[а-я]*|час[а-я]*|дн[а-я]*)\s*назад\b", " ", normalized)
        normalized = re.sub(r"\bfalse\b", " ", normalized)
        normalized = re.sub(r"\s+", " ", normalized).strip()
        return normalized

    def _budget_key(self, text):
        match = re.search(r"(?:до|от)?\s*\d[\d\s]{0,8}\s*(?:₽|руб)", text)
        return re.sub(r"\s+", "", match.group(0)) if match else ""

    def _important_tokens(self, text):
        stop_words = {
            "назад", "false", "дистанционно", "москва", "санкт", "петербург", "руб", "до", "от",
            "сайт", "сайта", "сайтов", "заказ", "заявка", "нужно", "нужна", "нужен",
            "функционал", "платформа", "контент", "есть", "нет", "все", "обговаривается",
            "время", "соглашения", "минут", "час", "день", "июл", "авг", "ср", "чт", "пт",
        }
        words = re.findall(r"[a-zа-яё0-9]+", text)
        return {word for word in words if len(word) > 1 and word not in stop_words}

    def _remember(self, order):
        self._seen_keys.add(self._key(order))
        if len(self._seen_keys) > 650:
            self._seen_keys = set(list(self._seen_keys)[-600:])
        self._save_seen()

    def _load_seen(self):
        if not self._seen_path.exists():
            return
        try:
            values = json.loads(self._seen_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        if isinstance(values, list):
            self._seen_keys = set(str(value) for value in values)

    def _save_seen(self):
        try:
            self._seen_path.parent.mkdir(parents=True, exist_ok=True)
            self._seen_path.write_text(json.dumps(list(self._seen_keys)[-600:], ensure_ascii=False), encoding="utf-8")
        except OSError:
            pass

    def _event(self, message, kind=""):
        with self._lock:
            self._events.append(MonitorEvent(message, kind))
            self._events = self._events[-50:]

    def serialize_lead(self, lead):
        return {
            "id": lead.id,
            "title": lead.title,
            "source_url": lead.source_url,
            "score": lead.score,
            "verdict": lead.verdict,
            "status": lead.get_status_display(),
            "created_at": lead.created_at.strftime("%d.%m %H:%M"),
            "updated_at": lead.updated_at.strftime("%d.%m %H:%M"),
        }
