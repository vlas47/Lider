from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="FreelanceLead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_id", models.CharField(max_length=80, unique=True)),
                ("title", models.CharField(max_length=220)),
                ("source_url", models.URLField(max_length=600)),
                ("raw_text", models.TextField()),
                ("category", models.CharField(blank=True, max_length=180)),
                ("budget_hint", models.CharField(blank=True, max_length=120)),
                ("published_hint", models.CharField(blank=True, max_length=120)),
                ("score", models.PositiveSmallIntegerField(default=0)),
                ("verdict", models.CharField(blank=True, max_length=80)),
                ("ai_notes", models.TextField(blank=True)),
                ("draft_reply", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("new", "Новая"),
                            ("review", "На просмотр"),
                            ("sent_to_max", "Отправлена в MAX"),
                            ("skipped", "Не подходит"),
                        ],
                        default="new",
                        max_length=20,
                    ),
                ),
                ("max_status", models.CharField(blank=True, max_length=180)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-score", "-created_at"]},
        ),
    ]
