import sqlite3
from contextlib import closing
from datetime import timezone as datetime_timezone
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from leads.models import Lead


COMMON_FIELDS = (
    "title",
    "source_url",
    "raw_text",
    "client_hint",
    "category",
    "budget_hint",
    "published_hint",
    "score",
    "verdict",
    "ai_notes",
    "draft_reply",
    "status",
    "max_status",
)


class Command(BaseCommand):
    help = "Import old AI_Lapin leads from a SQLite backup into the configured database."

    def add_arguments(self, parser):
        parser.add_argument("sqlite_path", help="Path to the preserved db.sqlite3 file")

    def handle(self, *args, **options):
        path = Path(options["sqlite_path"]).expanduser().resolve()
        if not path.is_file():
            raise CommandError(f"SQLite backup not found: {path}")

        imported = 0
        with closing(sqlite3.connect(path)) as connection:
            connection.row_factory = sqlite3.Row
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            if "leads_lead" in tables:
                imported += self.import_table(connection, "leads_lead")
            else:
                if "dashboard_profilead" in tables:
                    imported += self.import_table(
                        connection, "dashboard_profilead", Lead.SOURCE_PROFI
                    )
                if "freelance_freelancelead" in tables:
                    imported += self.import_table(
                        connection,
                        "freelance_freelancelead",
                        Lead.SOURCE_FREELANCE,
                    )

        self.stdout.write(self.style.SUCCESS(f"Imported or refreshed {imported} leads."))

    def import_table(self, connection, table, forced_source=None):
        columns = {
            row[1]
            for row in connection.execute(f'PRAGMA table_info("{table}")')
        }
        rows = connection.execute(f'SELECT * FROM "{table}"').fetchall()
        imported = 0
        for row in rows:
            source = forced_source or row["source"]
            source_id = self.value(row, columns, "source_id") or None
            values = {
                field: self.value(row, columns, field)
                for field in COMMON_FIELDS
            }
            values["title"] = values["title"] or "Заявка"
            values["raw_text"] = values["raw_text"] or values["title"]
            values["score"] = int(values["score"] or 0)

            if source_id:
                lead, _ = Lead.objects.update_or_create(
                    source=source,
                    source_id=source_id,
                    defaults=values,
                )
            else:
                identity = {
                    "source": source,
                    "source_id": None,
                    "source_url": values["source_url"],
                    "raw_text": values["raw_text"],
                }
                lead, _ = Lead.objects.update_or_create(
                    **identity,
                    defaults={
                        key: value
                        for key, value in values.items()
                        if key not in {"source_url", "raw_text"}
                    },
                )

            timestamps = {}
            for field in ("created_at", "updated_at"):
                raw_value = self.value(row, columns, field)
                if raw_value:
                    parsed = parse_datetime(str(raw_value))
                    if parsed and timezone.is_naive(parsed):
                        parsed = timezone.make_aware(parsed, datetime_timezone.utc)
                    timestamps[field] = parsed or raw_value
            if timestamps:
                Lead.objects.filter(pk=lead.pk).update(**timestamps)
            imported += 1
        return imported

    @staticmethod
    def value(row, columns, field):
        return row[field] if field in columns and row[field] is not None else ""
