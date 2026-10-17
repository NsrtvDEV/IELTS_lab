"""Загруженные файлы тестов (/media/...): путь на диске, длина записи, очистка."""

from collections.abc import Iterable
from pathlib import Path

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Passage, QuestionGroup, WritingTask

MEDIA_PREFIX = "/media/"


def media_path(url: str | None) -> Path | None:
    """Файл на диске для ссылки вида /media/audio/x.mp3; внешние ссылки — None."""
    if not url or not url.startswith(MEDIA_PREFIX):
        return None
    root = Path(settings.MEDIA_ROOT).resolve()
    path = (root / url.removeprefix(MEDIA_PREFIX)).resolve()
    return path if path.is_relative_to(root) else None  # защита от ../


def _duration(path: Path) -> int | None:
    import mutagen

    try:
        audio = mutagen.File(path)
    except Exception:  # битый или неизвестный формат — длину просто не знаем
        return None
    length = getattr(getattr(audio, "info", None), "length", None)
    return round(length) if length else None


async def audio_duration(url: str | None) -> int | None:
    """Длина загруженной записи в секундах (для внешних ссылок неизвестна)."""
    path = media_path(url)
    if not path or not path.is_file():
        return None
    return await run_in_threadpool(_duration, path)


async def remove_unused(session: AsyncSession, urls: Iterable[str | None]) -> None:
    """Удаляет с диска файлы, на которые больше не ссылается ни один тест.

    Вызывать после commit: проверяем по уже сохранённым данным.
    """
    for url in {u for u in urls if u}:
        path = media_path(url)
        if not path:
            continue
        used = await session.scalar(select(func.count()).where(Passage.audio_url == url))
        used += await session.scalar(select(func.count()).where(QuestionGroup.image_url == url))
        used += await session.scalar(select(func.count()).where(WritingTask.image_url == url))
        if not used:
            await run_in_threadpool(path.unlink, missing_ok=True)
