from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("freelance", "0001_initial"),
        ("leads", "0001_initial"),
    ]

    operations = [migrations.DeleteModel(name="FreelanceLead")]

