from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.dependencies import teacher_dep
from app.media import AUDIO_TYPES, audio_duration, file_type, store

router = APIRouter(prefix="/teacher/uploads", tags=["Teacher: uploads"])

IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
}
MAX_IMAGE_MB = 5


class UploadResponse(BaseModel):
    url: str  # путь от корня сервера: /media/<папка>/<имя>
    duration_sec: int | None = None  # для аудио — длина записи


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
