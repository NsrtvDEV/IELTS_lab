from django.apps import AppConfig


class IeltsConfig(AppConfig):
    default_auto_field = "django.db.models.AutoField"
    name = "ielts"
    verbose_name = "IELTS Lab"

    def ready(self):
        from ielts import security  # noqa: F401 — подписка на сигналы входа (защита от перебора)
