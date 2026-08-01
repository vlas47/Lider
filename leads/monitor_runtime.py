import atexit
import importlib
import logging
import os


logger = logging.getLogger(__name__)

MONITOR_MODULES = {
    "profi": "profi.server_browser",
    "freelance": "freelance.server_browser",
}


def _stop_browser(browser):
    try:
        browser.stop()
    except Exception:
        logger.exception("Could not stop the server browser cleanly")


def start_configured_monitor():
    """Start the platform browser in a dedicated WSGI worker.

    The normal web service does not set AI_LAPIN_MONITOR_PLATFORM and therefore
    never owns a browser. Dedicated systemd services set it to one platform and
    expose that platform's existing HTTP control API through their own socket.
    """

    platform = os.getenv("AI_LAPIN_MONITOR_PLATFORM", "").strip().lower()
    if not platform:
        return None
    if platform not in MONITOR_MODULES:
        raise RuntimeError(f"Unsupported AI_LAPIN_MONITOR_PLATFORM: {platform}")

    module = importlib.import_module(MONITOR_MODULES[platform])
    browser = module.server_browser
    logger.info("Starting dedicated %s monitor with catch-up", platform)
    browser.start()
    browser.start_monitor(catch_up=True)
    atexit.register(_stop_browser, browser)
    return browser
