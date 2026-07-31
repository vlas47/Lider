from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Project",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Активен"), ("paused", "Пауза"), ("done", "Завершен")],
                        default="active",
                        max_length=20,
                    ),
                ),
                ("priority", models.PositiveSmallIntegerField(default=2)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["priority", "-updated_at"]},
        ),
        migrations.CreateModel(
            name="Task",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=240)),
                ("details", models.TextField(blank=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("todo", "Сделать"), ("doing", "В работе"), ("waiting", "Ждет"), ("done", "Готово")],
                        default="todo",
                        max_length=20,
                    ),
                ),
                (
                    "priority",
                    models.PositiveSmallIntegerField(choices=[(1, "Высокий"), (2, "Обычный"), (3, "Низкий")], default=2),
                ),
                ("source", models.CharField(blank=True, default="", max_length=80)),
                ("due_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="tasks",
                        to="dashboard.project",
                    ),
                ),
            ],
            options={"ordering": ["priority", "-created_at"]},
        ),
        migrations.CreateModel(
            name="Decision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("context", models.TextField(blank=True)),
                ("decision", models.TextField()),
                ("decided_at", models.DateTimeField(auto_now_add=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "project",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="decisions",
                        to="dashboard.project",
                    ),
                ),
            ],
            options={"ordering": ["-decided_at"]},
        ),
        migrations.CreateModel(
            name="InboxItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                (
                    "kind",
                    models.CharField(
                        choices=[("task", "Задача"), ("note", "Заметка"), ("decision", "Решение"), ("raw", "Входящее")],
                        default="task",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("new", "Новое"), ("processed", "Разобрано"), ("archived", "Архив")],
                        default="new",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "task",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="inbox_items",
                        to="dashboard.task",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Note",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=180)),
                ("body", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "project",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notes",
                        to="dashboard.project",
                    ),
                ),
                (
                    "task",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notes",
                        to="dashboard.task",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
