from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("dashboard", "0003_alter_profilead_source_url"),
        ("leads", "0001_initial"),
    ]

    operations = [migrations.DeleteModel(name="ProfiLead")]

