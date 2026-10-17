"""Загруженные файлы (/media/...): сохранение, путь на диске, длина записи, очистка."""

import uuid
from collections.abc import Iterable
from pathlib import Path

from fastapi import HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Passage, QuestionGroup, WritingTask

MEDIA_PREFIX = "/media/"
CHUNK = 1024 * 1024

AUDIO_TYPES = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/mp4": ".m4a",
    "audio/x-m4a": ".m4a",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/ogg": ".ogg",
    "audio/webm": ".webm",
}


def file_type(file: UploadFile) -> str:
    return (file.content_type or "").split(";")[0].lower()


async def store(file: UploadFile, folder: str, extension: str, max_mb: int) -> str:
    """Сохраняет файл кусками, не держа его целиком в памяти; больше лимита — 413."""
    name = f"{uuid.uuid4().hex}{extension}"
    path = Path(settings.MEDIA_ROOT) / folder / name
    path.parent.mkdir(parents=True, exist_ok=True)
    size = 0
    with path.open("wb") as out:
        while chunk := await file.read(CHUNK):
            size += len(chunk)
            if size > max_mb * CHUNK:
                out.close()
                path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File is larger than {max_mb} MB")
            await run_in_threadpool(out.write, chunk)
    if size == 0:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="The file is empty")
    return f"/media/{folder}/{name}"


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
