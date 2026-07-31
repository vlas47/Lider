import json
import ssl
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from leads.services import send_max_text


class Command(BaseCommand):
    help = "Проверяет MAX-бота, показывает chat_id из updates и отправляет тестовое сообщение."

    def add_arguments(self, parser):
        parser.add_argument("--updates", action="store_true", help="Показать последние updates.")
        parser.add_argument("--send-test", action="store_true", help="Отправить тестовое сообщение.")
        parser.add_argument("--chat-id", default="", help="chat_id для тестовой отправки.")
        parser.add_argument("--user-id", default="", help="user_id для тестовой отправки.")
        parser.add_argument("--marker", default="", help="marker для GET /updates.")
        parser.add_argument("--limit", type=int, default=20)
        parser.add_argument("--timeout", type=int, default=0)

    def handle(self, *args, **options):
        if not settings.MAX_BOT_TOKEN:
            raise CommandError("MAX_BOT_TOKEN не задан в окружении или .env")

        bot_info = self.get_json("/me")
        self.stdout.write(self.style.SUCCESS(f"MAX bot: {bot_info.get('name', 'unknown')}"))
        if bot_info.get("username"):
            self.stdout.write(f"username: {bot_info['username']}")

        if options["send_test"]:
            self.send_test(options)
            return

        if options["updates"]:
            self.print_updates(options)
            return

        self.stdout.write("Команды:")
        self.stdout.write("  python manage.py max_bot --updates")
        self.stdout.write("  python manage.py max_bot --send-test --chat-id <id>")

    def send_test(self, options):
        chat_id = options["chat_id"].strip()
        user_id = options["user_id"].strip()
        if chat_id:
            result = send_max_text("AI_Lapin: тестовое уведомление подключено.", chat_id, "chat_id")
        elif user_id:
            result = send_max_text("AI_Lapin: тестовое уведомление подключено.", user_id, "user_id")
        else:
            result = send_max_text("AI_Lapin: тестовое уведомление подключено.")
        self.stdout.write(result)

    def print_updates(self, options):
        params = {
            "limit": max(1, min(options["limit"], 1000)),
            "timeout": max(0, min(options["timeout"], 90)),
        }
        if options["marker"]:
            params["marker"] = options["marker"]
        payload = self.get_json("/updates", params=params)
        updates = payload.get("updates") or []
        marker = payload.get("marker")

        self.stdout.write(f"updates: {len(updates)}")
        if marker is not None:
            self.stdout.write(f"marker: {marker}")
        for update in updates:
            self.print_update(update)

    def print_update(self, update):
        update_type = update.get("update_type") or update.get("type") or "unknown"
        chat_ids = sorted(set(self.find_values(update, "chat_id")))
        user_ids = sorted(set(self.find_values(update, "user_id")))
        text_values = [value for value in self.find_values(update, "text") if isinstance(value, str)]
        preview = text_values[0][:120] if text_values else ""
        self.stdout.write("-" * 48)
        self.stdout.write(f"type: {update_type}")
        if chat_ids:
            self.stdout.write(f"chat_id: {', '.join(str(value) for value in chat_ids)}")
        if user_ids:
            self.stdout.write(f"user_id: {', '.join(str(value) for value in user_ids)}")
        if preview:
            self.stdout.write(f"text: {preview}")

    def get_json(self, path, params=None):
        query = f"?{urllib.parse.urlencode(params)}" if params else ""
        url = f"{settings.MAX_API_BASE.rstrip('/')}{path}{query}"
        request = urllib.request.Request(url, headers={"Authorization": settings.MAX_BOT_TOKEN}, method="GET")
        context = ssl.create_default_context(cafile=settings.MAX_CA_BUNDLE) if settings.MAX_CA_BUNDLE else None
        try:
            with urllib.request.urlopen(request, timeout=20, context=context) as response:
                body = response.read().decode("utf-8")
        except urllib.error.HTTPError as error:
            raise CommandError(f"MAX HTTP {error.code}: {error.read().decode('utf-8', errors='replace')[:300]}")
        except urllib.error.URLError as error:
            raise CommandError(f"MAX network error: {error}")
        return json.loads(body) if body else {}

    def find_values(self, obj, key):
        if isinstance(obj, dict):
            for current_key, value in obj.items():
                if current_key == key:
                    yield value
                yield from self.find_values(value, key)
        elif isinstance(obj, list):
            for item in obj:
                yield from self.find_values(item, key)
