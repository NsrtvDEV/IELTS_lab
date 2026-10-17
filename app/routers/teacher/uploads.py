import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from app.config import settings
from app.dependencies import teacher_dep

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
    url: str  # путь от корня сервера: /media/images/<имя>


def save(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


@router.post("/images", response_model=UploadResponse, status_code=201)
async def upload_image(teacher: teacher_dep, file: UploadFile = File(...)):
    """Картинка к вопросам: схема, карта, таблица, flow-chart (до 5 МБ)."""
    content_type = (file.content_type or "").split(";")[0]
    extension = IMAGE_TYPES.get(content_type)
    if not extension:
        raise HTTPException(status_code=415, detail="Upload a PNG, JPG, WEBP, GIF or SVG image")

    content = await file.read(MAX_IMAGE_MB * 1024 * 1024 + 1)
    if len(content) > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image is larger than {MAX_IMAGE_MB} MB")

    name = f"{uuid.uuid4().hex}{extension}"
    await run_in_threadpool(save, Path(settings.MEDIA_ROOT) / "images" / name, content)
    return UploadResponse(url=f"/media/images/{name}")
