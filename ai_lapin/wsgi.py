import os

from django.core.wsgi import get_wsgi_application

from leads.monitor_runtime import start_configured_monitor


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ai_lapin.settings")

application = get_wsgi_application()
monitor_browser = start_configured_monitor()
