from django.db import models


class Project(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_PAUSED = "paused"
    STATUS_DONE = "done"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Активен"),
        (STATUS_PAUSED, "Пауза"),
        (STATUS_DONE, "Завершен"),
    ]

    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    priority = models.PositiveSmallIntegerField(default=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["priority", "-updated_at"]

    def __str__(self) -> str:
        return self.title


class Task(models.Model):
    STATUS_TODO = "todo"
    STATUS_DOING = "doing"
    STATUS_WAITING = "waiting"
    STATUS_DONE = "done"

    STATUS_CHOICES = [
        (STATUS_TODO, "Сделать"),
        (STATUS_DOING, "В работе"),
        (STATUS_WAITING, "Ждет"),
        (STATUS_DONE, "Готово"),
    ]

    PRIORITY_CHOICES = [
        (1, "Высокий"),
        (2, "Обычный"),
        (3, "Низкий"),
    ]

    project = models.ForeignKey(Project, blank=True, null=True, on_delete=models.SET_NULL, related_name="tasks")
    title = models.CharField(max_length=240)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_TODO)
    priority = models.PositiveSmallIntegerField(choices=PRIORITY_CHOICES, default=2)
    source = models.CharField(max_length=80, blank=True, default="")
    due_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["priority", "-created_at"]

    def __str__(self) -> str:
        return self.title


class InboxItem(models.Model):
    KIND_TASK = "task"
    KIND_NOTE = "note"
    KIND_DECISION = "decision"
    KIND_RAW = "raw"

    KIND_CHOICES = [
        (KIND_TASK, "Задача"),
        (KIND_NOTE, "Заметка"),
        (KIND_DECISION, "Решение"),
        (KIND_RAW, "Входящее"),
    ]

    STATUS_NEW = "new"
    STATUS_PROCESSED = "processed"
    STATUS_ARCHIVED = "archived"

    STATUS_CHOICES = [
        (STATUS_NEW, "Новое"),
        (STATUS_PROCESSED, "Разобрано"),
        (STATUS_ARCHIVED, "Архив"),
    ]

    text = models.TextField()
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_TASK)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_NEW)
    task = models.ForeignKey(Task, blank=True, null=True, on_delete=models.SET_NULL, related_name="inbox_items")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.text[:80]


class Note(models.Model):
    project = models.ForeignKey(Project, blank=True, null=True, on_delete=models.SET_NULL, related_name="notes")
    task = models.ForeignKey(Task, blank=True, null=True, on_delete=models.SET_NULL, related_name="notes")
    title = models.CharField(max_length=180)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class Decision(models.Model):
    project = models.ForeignKey(Project, blank=True, null=True, on_delete=models.SET_NULL, related_name="decisions")
    title = models.CharField(max_length=180)
    context = models.TextField(blank=True)
    decision = models.TextField()
    decided_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-decided_at"]

    def __str__(self) -> str:
        return self.title
