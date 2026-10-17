import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.config import settings
from app.dependencies import teacher_dep
from app.media import audio_duration

router = APIRouter(prefix="/teacher/uploads", tags=["Teacher: uploads"])

IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}
MAX_IMAGE_MB = 5

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
CHUNK = 1024 * 1024


class UploadResponse(BaseModel):
    url: str  # путь от корня сервера: /media/<папка>/<имя>
    duration_sec: int | None = None  # для аудио — длина записи


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


def file_type(file: UploadFile) -> str:
    return (file.content_type or "").split(";")[0].lower()


@router.post("/images", response_model=UploadResponse, status_code=201)
async def upload_image(teacher: teacher_dep, file: UploadFile = File(...)):
    """Картинка к вопросам: схема, карта, таблица, flow-chart (до 5 МБ)."""
    extension = IMAGE_TYPES.get(file_type(file))
    if not extension:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPG, WEBP, GIF or SVG image")
    return UploadResponse(url=await store(file, "images", extension, MAX_IMAGE_MB))


@router.post("/audio", response_model=UploadResponse, status_code=201)
async def upload_audio(teacher: teacher_dep, file: UploadFile = File(...)):
    """Запись части Listening: mp3, m4a, aac, wav, ogg или webm."""
    extension = AUDIO_TYPES.get(file_type(file))
    if not extension:
        raise HTTPException(status_code=415, detail="Upload an MP3, M4A, AAC, WAV, OGG or WEBM audio file")
    url = await store(file, "audio", extension, settings.MAX_LISTENING_AUDIO_MB)
    return UploadResponse(url=url, duration_sec=await audio_duration(url))
