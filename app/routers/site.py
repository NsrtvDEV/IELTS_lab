"""Публичное содержимое сайта (лендинг)."""

from fastapi import APIRouter

from app.database import db_dep
from app.models import SiteContent
from app.schemas.site import LandingContent

router = APIRouter(prefix="/site", tags=["Site"])

LANDING_KEY = "landing"


async def stored_landing(session) -> LandingContent:
    row = await session.get(SiteContent, LANDING_KEY)
    return LandingContent.model_validate(row.value) if row else LandingContent()


@router.get("/landing", response_model=LandingContent, response_model_exclude_none=True)
async def landing(session: db_dep):
    """Изменения администратора; чего нет — фронтенд показывает стандартный текст."""
    return await stored_landing(session)
