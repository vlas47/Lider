from leads.api import PlatformLeadApiView, PlatformServerCommandView, PlatformServerScreenshotView
from leads.services import create_profi_lead_from_text

from .models import ProfiLead
from .server_browser import server_browser


class ProfiServerCommandView(PlatformServerCommandView):
    browser = server_browser
    lead_model = ProfiLead


class ProfiServerScreenshotView(PlatformServerScreenshotView):
    browser = server_browser


class ProfiLeadApiView(PlatformLeadApiView):
    lead_model = ProfiLead
    lead_factory = staticmethod(create_profi_lead_from_text)

