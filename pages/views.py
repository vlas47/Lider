from django.templatetags.static import static
from django.urls import reverse
from django.views.generic import TemplateView


class HomeView(TemplateView):
    template_name = "pages/home.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["home_config"] = {
            "images": {
                "founder": static("img/founder-photo.png"),
                "nextGen": static("img/next-gen-photo.jpg"),
                "portfolioDomkapsul": static("img/portfolio-domkapsul.jpg"),
                "portfolioFullbox": static("img/portfolio-fullbox.jpg"),
                "portfolioNozbart": static("img/portfolio-nozbart-russia.png"),
                "portfolioAshtanga": static("img/portfolio-ashtanga-yoga.jpg"),
                "portfolioSoyz": static("img/portfolio-soyz-zastroi.jpg"),
            },
            "urls": {
                "contact": "#contact",
                "phone": "tel:+79180916494",
                "industrial": reverse("pages:industrial-digitization"),
                "cabinet": reverse("pages:service-login"),
            },
            "cabinetLabel": "Вход в кабинет",
        }
        return context


class PlaceholderView(TemplateView):
    template_name = "pages/placeholder.html"
    title = ""
    text = ""

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title
        context["text"] = self.text
        return context
