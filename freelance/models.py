from leads.models import Lead, PlatformLeadManager


class FreelanceLeadManager(PlatformLeadManager):
    source = Lead.SOURCE_FREELANCE


class FreelanceLead(Lead):
    objects = FreelanceLeadManager()

    class Meta:
        proxy = True
        verbose_name = "Заявка Freelance.ru"
        verbose_name_plural = "Заявки Freelance.ru"

