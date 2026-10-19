"""Django используется только как админка поверх той же БД, что и FastAPI.

Схемой таблиц приложения управляет Alembic; Django создаёт только свои служебные
таблицы (auth_*, django_*) командой `migrate`.
"""

from pathlib import Path

from app.config import settings as app_settings

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = app_settings.DEBUG
# свой ключ, не тот, что подписывает JWT API; локально без него — общий (на сервере config.py это не пропустит)
SECRET_KEY = app_settings.ADMIN_SECRET_KEY or app_settings.SECRET_KEY
ALLOWED_HOSTS = app_settings.ADMIN_HOSTS
CSRF_TRUSTED_ORIGINS = app_settings.ADMIN_CSRF_ORIGINS

if not DEBUG:
    # админка работает за nginx по HTTPS: cookie только по HTTPS, схему берём из заголовка прокси
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
SESSION_COOKIE_AGE = 8 * 60 * 60  # вход в админку — на рабочий день
X_FRAME_OPTIONS = "DENY"

INSTALLED_APPS = [
    "jazzmin",  # тема админки — должна стоять до django.contrib.admin
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "ielts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "ielts.security.AdminLoginThrottleMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": app_settings.DB_NAME,
        "USER": app_settings.DB_USER,
        "PASSWORD": app_settings.DB_PASSWORD,
        "HOST": app_settings.DB_HOST,
        "PORT": app_settings.DB_PORT,
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ───────────────────────── Jazzmin (тема админки) ─────────────────────────

JAZZMIN_SETTINGS = {
    "site_title": "BandUp Admin",
    "site_header": "BandUp",
    "site_brand": "BandUp",
    "welcome_sign": "Администрирование BandUp — IELTS Learning Platform",
    "copyright": "BandUp",
    "site_logo": "ielts/logo.svg",  # admin_panel/ielts/static/ielts/logo.svg
    "login_logo": "ielts/logo.svg",
    "site_icon": "ielts/logo.svg",
    "site_logo_classes": "img-circle bg-white p-1",
    "search_model": ["ielts.User", "ielts.IeltsTest"],
    "topmenu_links": [
        {"name": "Главная", "url": "admin:index"},
        {"name": "API (Swagger)", "url": "http://127.0.0.1:8001/docs", "new_window": True},
    ],
    "show_ui_builder": False,
    "navigation_expanded": True,
    "order_with_respect_to": [
        "ielts",
        "ielts.User",
        "ielts.IeltsTest",
        "ielts.Section",
        "ielts.QuestionGroup",
        "ielts.Question",
        "ielts.BandConversion",
        "ielts.TestAttempt",
        "ielts.SectionAttempt",
        "ielts.WritingAssessment",
        "auth",
    ],
    "icons": {
        "auth": "fas fa-user-shield",
        "auth.user": "fas fa-user-cog",
        "auth.Group": "fas fa-users-cog",
        "ielts.User": "fas fa-user-graduate",
        "ielts.IeltsTest": "fas fa-file-alt",
        "ielts.Section": "fas fa-layer-group",
        "ielts.QuestionGroup": "fas fa-list-ol",
        "ielts.Question": "fas fa-question-circle",
        "ielts.BandConversion": "fas fa-exchange-alt",
        "ielts.TestAttempt": "fas fa-clipboard-check",
        "ielts.SectionAttempt": "fas fa-tasks",
        "ielts.WritingAssessment": "fas fa-pen-nib",
    },
    "default_icon_parents": "fas fa-folder",
    "default_icon_children": "fas fa-circle",
    "changeform_format": "horizontal_tabs",
    "related_modal_active": True,
}

JAZZMIN_UI_TWEAKS = {
    "theme": "flatly",
    "default_theme_mode": "auto",  # светлая или тёмная — как в системе
    "navbar": "navbar-primary navbar-dark",
    "sidebar": "sidebar-dark-primary",
    "brand_colour": "navbar-primary",
    "accent": "accent-primary",
    "sidebar_nav_child_indent": True,
}
