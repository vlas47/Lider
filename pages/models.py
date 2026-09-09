from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models


def private_brief_storage():
    return FileSystemStorage(location=settings.BASE_DIR / "private_uploads")


def brief_path(instance, filename):
    return f"website-briefs/{uuid4().hex}{Path(filename).suffix.lower()}"


class WebsiteRequest(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Новая"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Завершена"
        SPAM = "spam", "Спам"

    service_slug = models.CharField("Формат сайта", max_length=80)
    name = models.CharField("Имя", max_length=160)
    phone = models.CharField("Телефон", max_length=40)
    email = models.EmailField("Почта", blank=True)
    comment = models.TextField("Комментарий", blank=True)
    brief = models.FileField("Техническое задание", storage=private_brief_storage, upload_to=brief_path, blank=True)
    consent = models.BooleanField("Согласие на обработку данных", default=False)
    source_url = models.CharField("Страница отправки", max_length=300, blank=True)
    status = models.CharField(
        "Статус",
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
    )
    created_at = models.DateTimeField("Создана", auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Заявка на сайт"
        verbose_name_plural = "Заявки на сайты"

    def __str__(self):
        return f"{self.name}: {self.service_slug}"
