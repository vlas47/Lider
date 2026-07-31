from django.db import models


class PlatformLeadManager(models.Manager):
    """Manager that exposes only one marketplace through a proxy model."""

    source = ""

    def get_queryset(self):
        return super().get_queryset().filter(source=self.source)

    def create(self, **kwargs):
        kwargs.setdefault("source", self.source)
        return super().create(**kwargs)


class Lead(models.Model):
    SOURCE_PROFI = "profi"
    SOURCE_FREELANCE = "freelance"
    SOURCE_CHOICES = [
        (SOURCE_PROFI, "Profi.ru"),
        (SOURCE_FREELANCE, "Freelance.ru"),
    ]

    STATUS_NEW = "new"
    STATUS_REVIEW = "review"
    STATUS_SENT_TO_MAX = "sent_to_max"
    STATUS_SKIPPED = "skipped"
    STATUS_CHOICES = [
        (STATUS_NEW, "Новая"),
        (STATUS_REVIEW, "На просмотр"),
        (STATUS_SENT_TO_MAX, "Отправлена в MAX"),
        (STATUS_SKIPPED, "Не подходит"),
    ]

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, db_index=True)
    source_id = models.CharField(max_length=120, blank=True, null=True)
    title = models.CharField(max_length=220)
    source_url = models.URLField(max_length=600, blank=True)
    raw_text = models.TextField()
    client_hint = models.CharField(max_length=160, blank=True)
    category = models.CharField(max_length=180, blank=True)
    budget_hint = models.CharField(max_length=120, blank=True)
    published_hint = models.CharField(max_length=120, blank=True)
    score = models.PositiveSmallIntegerField(default=0)
    verdict = models.CharField(max_length=80, blank=True)
    ai_notes = models.TextField(blank=True)
    draft_reply = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    max_status = models.CharField(max_length=180, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-score", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["source", "source_id"],
                name="unique_lead_source_id",
            )
        ]

    def __str__(self) -> str:
        return self.title

