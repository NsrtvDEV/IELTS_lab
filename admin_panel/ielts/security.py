"""Защита входа в админку от перебора паролей: не больше N неудачных попыток с одного IP за 15 минут."""

from django.contrib.auth.signals import user_logged_in, user_login_failed
from django.core.cache import cache
from django.dispatch import receiver
from django.http import HttpResponse

from app.config import settings as app_settings

WINDOW_SECONDS = 15 * 60


def client_ip(request) -> str:
    """IP клиента; за доверенным прокси (nginx) — последний адрес из X-Forwarded-For, его добавил сам прокси."""
    ip = request.META.get("REMOTE_ADDR", "")
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if ip in app_settings.TRUSTED_PROXIES and forwarded:
        ip = forwarded.split(",")[-1].strip()
    return ip


def cache_key(request) -> str:
    return f"admin-login-failed:{client_ip(request)}"


@receiver(user_login_failed)
def count_failure(sender, credentials, request=None, **kwargs):
    if request is None:
        return
    key = cache_key(request)
    cache.add(key, 0, WINDOW_SECONDS)
    cache.incr(key)


@receiver(user_logged_in)
def reset_failures(sender, request, user, **kwargs):
    cache.delete(cache_key(request))


class AdminLoginThrottleMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if (
            request.method == "POST"
            and request.path.endswith("/login/")
            and cache.get(cache_key(request), 0) >= app_settings.ADMIN_LOGIN_ATTEMPTS
        ):
            return HttpResponse(
                "Слишком много неудачных попыток входа. Попробуйте через 15 минут.",
                status=429,
                content_type="text/plain; charset=utf-8",
            )
        return self.get_response(request)
