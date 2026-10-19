"""Письма: отправка через SMTP; без SMTP_HOST (разработка) письмо пишется в лог."""

import logging
import smtplib
import ssl
from email.message import EmailMessage
from html import escape

from fastapi.concurrency import run_in_threadpool

from app.config import settings

log = logging.getLogger("bandup.mail")


def _send(message: EmailMessage) -> None:
    if settings.SMTP_SSL:
        server = smtplib.SMTP_SSL(
            settings.SMTP_HOST, settings.SMTP_PORT, context=ssl.create_default_context(), timeout=20
        )
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        server.starttls(context=ssl.create_default_context())
    with server:
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(message)


async def send_email(to: str, subject: str, text: str, html: str) -> None:
    """Отправляется в фоне после ответа — ошибки не роняют запрос, а пишутся в лог."""
    message = EmailMessage()
    message["From"] = settings.SMTP_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    if not settings.SMTP_HOST:
        if settings.DEBUG:
            log.warning("SMTP_HOST is not set — email not sent. To: %s\nSubject: %s\n\n%s", to, subject, text)
        else:
            log.error("SMTP_HOST is not set — cannot send email to %s (%s)", to, subject)
        return
    try:
        await run_in_threadpool(_send, message)
    except Exception:
        log.exception("Failed to send email to %s (%s)", to, subject)


# ───────────────────────── Письма ─────────────────────────

RESET_TEXTS = {
    "en": {
        "subject": "Reset your BandUp password",
        "hello": "Hello{name},",
        "intro": "We received a request to reset the password for your BandUp account.",
        "button": "Set a new password",
        "expires": "The link works once and expires in {minutes} minutes.",
        "ignore": "If you didn't ask for this, just ignore this email — your password stays the same.",
    },
    "ru": {
        "subject": "Сброс пароля BandUp",
        "hello": "Здравствуйте{name}!",
        "intro": "Мы получили запрос на сброс пароля для вашего аккаунта BandUp.",
        "button": "Задать новый пароль",
        "expires": "Ссылка работает один раз и действует {minutes} минут.",
        "ignore": "Если вы не запрашивали сброс, просто проигнорируйте это письмо — пароль останется прежним.",
    },
}


def password_reset_email(link: str, first_name: str | None, lang: str) -> tuple[str, str, str]:
    """(тема, текст, html) письма со ссылкой на сброс пароля."""
    t = RESET_TEXTS.get(lang, RESET_TEXTS["en"])
    hello = t["hello"].format(name=f", {first_name}" if first_name else "")
    expires = t["expires"].format(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)
    text = f"{hello}\n\n{t['intro']}\n\n{t['button']}: {link}\n\n{expires}\n{t['ignore']}\n\n— BandUp"
    html = f"""<!doctype html>
<html><body style="margin:0;background:#f7f9fd;font-family:Arial,Helvetica,sans-serif;color:#0f1b3d">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e3e8f2">
    <div style="font-size:24px;font-weight:800;color:#2f6bff">BandUp</div>
    <p style="font-size:16px;margin:24px 0 8px">{escape(hello)}</p>
    <p style="font-size:15px;line-height:1.5;margin:0 0 24px">{escape(t["intro"])}</p>
    <a href="{escape(link)}" style="display:inline-block;background:#2f6bff;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px">{escape(t["button"])}</a>
    <p style="font-size:13px;color:#5b6783;line-height:1.5;margin:24px 0 0">{escape(expires)}<br>{escape(t["ignore"])}</p>
  </div>
</body></html>"""
    return t["subject"], text, html
