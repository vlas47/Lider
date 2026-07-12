from django.conf import settings
from django.http import HttpResponsePermanentRedirect


class CanonicalHostMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        canonical_host = getattr(settings, "SITE_CANONICAL_HOST", "")
        host = request.get_host().split(":", 1)[0].lower()

        if canonical_host and host == f"www.{canonical_host}".lower():
            scheme = getattr(settings, "SITE_CANONICAL_SCHEME", "https")
            url = f"{scheme}://{canonical_host}{request.get_full_path()}"
            return HttpResponsePermanentRedirect(url)

        return self.get_response(request)
