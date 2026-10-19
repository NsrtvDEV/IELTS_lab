"""Отправка писем через SMTP (без настоящего сервера) и текст письма о сбросе пароля."""

from app import mail
from app.config import settings


class FakeSMTP:
    instances: list["FakeSMTP"] = []

    def __init__(self, host, port, **kwargs):
        self.host, self.port, self.calls = host, port, []
        FakeSMTP.instances.append(self)

    def starttls(self, **kwargs):
        self.calls.append("starttls")

    def login(self, user, password):
        self.calls.append(("login", user))

    def send_message(self, message):
        self.calls.append(("send", message["To"], message["Subject"], message.is_multipart()))

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.calls.append("quit")


async def test_sends_with_starttls_and_login(monkeypatch):
    FakeSMTP.instances.clear()
    monkeypatch.setattr(mail.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_USER", "bandup")
    monkeypatch.setattr(settings, "SMTP_SSL", False)
    await mail.send_email("aziza@example.com", "Hi", "text", "<p>html</p>")
    server = FakeSMTP.instances[0]
    assert (server.host, server.port) == ("smtp.example.com", settings.SMTP_PORT)
    assert server.calls == ["starttls", ("login", "bandup"), ("send", "aziza@example.com", "Hi", True), "quit"]


async def test_smtp_errors_do_not_break_the_request(monkeypatch):
    def broken(*args, **kwargs):
        raise OSError("connection refused")

    monkeypatch.setattr(mail.smtplib, "SMTP", broken)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(settings, "SMTP_SSL", False)
    await mail.send_email("aziza@example.com", "Hi", "text", "<p>html</p>")  # не падает, пишет в лог


def test_reset_email_texts():
    subject, text, html = mail.password_reset_email("https://bandup.uz/reset-password?token=abc", "Aziza", "ru")
    assert subject == "Сброс пароля BandUp"
    assert "Здравствуйте, Aziza!" in text and "https://bandup.uz/reset-password?token=abc" in text
    assert 'href="https://bandup.uz/reset-password?token=abc"' in html
    subject, text, _ = mail.password_reset_email("https://x/r?token=1", None, "en")
    assert subject == "Reset your BandUp password" and text.startswith("Hello,")
    # имя экранируется в HTML
    _, _, html = mail.password_reset_email("https://x/r?token=1", "<b>x</b>", "en")
    assert "<b>x</b>" not in html
