from leads.models import Lead, PlatformLeadManager


class ProfiLeadManager(PlatformLeadManager):
    source = Lead.SOURCE_PROFI


class ProfiLead(Lead):
    objects = ProfiLeadManager()

    class Meta:
        proxy = True
        verbose_name = "Заявка Profi.ru"
        verbose_name_plural = "Заявки Profi.ru"

