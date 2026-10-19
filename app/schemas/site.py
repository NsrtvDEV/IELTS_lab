"""Тексты лендинга, которые редактирует администратор.

Любое поле может отсутствовать — тогда сайт показывает стандартный текст (он задан во фронтенде).
"""

import re
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, Field, StringConstraints, field_validator


def empty_to_none(value):
    if isinstance(value, str) and not value.strip():
        return None
    return value


def optional_text(max_length: int):
    """Строка до max_length символов; пустая — None (стандартный текст)."""
    return Annotated[
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)] | None,
        BeforeValidator(empty_to_none),
    ]


class LandingItem(BaseModel):
    title: optional_text(60) = None
    text: optional_text(300) = None


class LandingTexts(BaseModel):
    hero_badge: optional_text(100) = None
    hero_title: optional_text(80) = None
    hero_title_accent: optional_text(80) = None
    hero_subtitle: optional_text(400) = None
    hero_primary: optional_text(40) = None
    hero_secondary: optional_text(40) = None
    hero_note: optional_text(120) = None  # рукописная фраза, строки через перенос

    features_eyebrow: optional_text(60) = None
    features_title: optional_text(120) = None
    features_subtitle: optional_text(400) = None
    features: list[LandingItem] = Field(default=[], max_length=4)

    skills_badge: optional_text(60) = None
    skills_title: optional_text(120) = None
    skills_subtitle: optional_text(400) = None
    skills_button: optional_text(40) = None
    skills: list[LandingItem] = Field(default=[], max_length=4)  # Reading, Listening, Writing, Speaking

    about_eyebrow: optional_text(60) = None
    about_title: optional_text(120) = None
    about_text: optional_text(1200) = None
    about_points: (
        list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]] | None
    ) = Field(default=None, max_length=6)
    contact_title: optional_text(80) = None
    contact_text: optional_text(400) = None
    contact_button: optional_text(40) = None

    cta_title: optional_text(120) = None
    cta_text: optional_text(300) = None
    cta_button: optional_text(40) = None


class LandingSettings(BaseModel):
    show_stats: bool = True
    show_features: bool = True
    show_skills: bool = True
    show_about: bool = True
    show_cta: bool = True
    hero_image_url: optional_text(500) = None  # своя фотография на главном экране
    telegram_url: optional_text(200) = None  # пусто — берётся из настроек сайта (VITE_TELEGRAM_URL)

    @field_validator("hero_image_url")
    @classmethod
    def our_image_or_https(cls, value):
        if value and not (value.startswith("/media/images/") or value.startswith("https://")):
            raise ValueError("Upload an image or give an https:// link")
        return value

    @field_validator("telegram_url")
    @classmethod
    def telegram_link(cls, value):
        if not value:
            return value
        username = re.sub(r"^(https?://)?(t\.me/)?@?", "", value).strip("/")
        if not re.fullmatch(r"[A-Za-z0-9_]{4,64}", username):
            raise ValueError("Telegram: @username or https://t.me/username")
        return f"https://t.me/{username}"


class LandingContent(BaseModel):
    settings: LandingSettings = LandingSettings()
    en: LandingTexts = LandingTexts()
    ru: LandingTexts = LandingTexts()
