from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("freelance", "0002_move_to_shared_leads")]

    operations = [
        migrations.CreateModel(
            name="FreelanceLead",
            fields=[],
            options={
                "verbose_name": "Заявка Freelance.ru",
                "verbose_name_plural": "Заявки Freelance.ru",
                "proxy": True,
                "indexes": [],
                "constraints": [],
            },
            bases=("leads.lead",),
        )
    ]

