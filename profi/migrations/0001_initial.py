from django.db import migrations


class Migration(migrations.Migration):
    initial = True

    dependencies = [("leads", "0001_initial")]

    operations = [
        migrations.CreateModel(
            name="ProfiLead",
            fields=[],
            options={
                "verbose_name": "Заявка Profi.ru",
                "verbose_name_plural": "Заявки Profi.ru",
                "proxy": True,
                "indexes": [],
                "constraints": [],
            },
            bases=("leads.lead",),
        )
    ]

