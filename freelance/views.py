from leads.api import PlatformLeadApiView, PlatformServerCommandView, PlatformServerScreenshotView
from leads.services import create_freelance_lead_from_text

from .models import FreelanceLead
from .server_browser import server_browser


class FreelanceServerCommandView(PlatformServerCommandView):
    browser = server_browser
    lead_model = FreelanceLead


class FreelanceServerScreenshotView(PlatformServerScreenshotView):
    browser = server_browser


class FreelanceLeadApiView(PlatformLeadApiView):
    lead_model = FreelanceLead
    lead_factory = staticmethod(create_freelance_lead_from_text)

