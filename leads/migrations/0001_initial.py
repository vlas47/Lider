from django.db import migrations, models


def copy_existing_leads(apps, schema_editor):
    Lead = apps.get_model("leads", "Lead")
    ProfiLead = apps.get_model("dashboard", "ProfiLead")
    FreelanceLead = apps.get_model("freelance", "FreelanceLead")

    for old in ProfiLead.objects.all().iterator():
        lead = Lead.objects.create(
            source="profi",
            source_id=None,
            title=old.title,
            source_url=old.source_url,
            raw_text=old.raw_text,
            client_hint=old.client_hint,
            budget_hint=old.budget_hint,
            score=old.score,
            verdict=old.verdict,
            ai_notes=old.ai_notes,
            draft_reply=old.draft_reply,
            status=old.status,
            max_status=old.max_status,
        )
        Lead.objects.filter(pk=lead.pk).update(created_at=old.created_at, updated_at=old.updated_at)

    for old in FreelanceLead.objects.all().iterator():
        lead = Lead.objects.create(
            source="freelance",
            source_id=old.source_id or None,
            title=old.title,
            source_url=old.source_url,
            raw_text=old.raw_text,
            category=old.category,
            budget_hint=old.budget_hint,
            published_hint=old.published_hint,
            score=old.score,
            verdict=old.verdict,
            ai_notes=old.ai_notes,
            draft_reply=old.draft_reply,
            status=old.status,
            max_status=old.max_status,
        )
        Lead.objects.filter(pk=lead.pk).update(created_at=old.created_at, updated_at=old.updated_at)


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("dashboard", "0003_alter_profilead_source_url"),
        ("freelance", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="Lead",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(choices=[("profi", "Profi.ru"), ("freelance", "Freelance.ru")], db_index=True, max_length=20)),
                ("source_id", models.CharField(blank=True, max_length=120, null=True)),
                ("title", models.CharField(max_length=220)),
                ("source_url", models.URLField(blank=True, max_length=600)),
                ("raw_text", models.TextField()),
                ("client_hint", models.CharField(blank=True, max_length=160)),
                ("category", models.CharField(blank=True, max_length=180)),
                ("budget_hint", models.CharField(blank=True, max_length=120)),
                ("published_hint", models.CharField(blank=True, max_length=120)),
                ("score", models.PositiveSmallIntegerField(default=0)),
                ("verdict", models.CharField(blank=True, max_length=80)),
                ("ai_notes", models.TextField(blank=True)),
                ("draft_reply", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("new", "Новая"), ("review", "На просмотр"), ("sent_to_max", "Отправлена в MAX"), ("skipped", "Не подходит")], default="new", max_length=20)),
                ("max_status", models.CharField(blank=True, max_length=180)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-score", "-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="lead",
            constraint=models.UniqueConstraint(fields=("source", "source_id"), name="unique_lead_source_id"),
        ),
        migrations.RunPython(copy_existing_leads, migrations.RunPython.noop),
    ]
