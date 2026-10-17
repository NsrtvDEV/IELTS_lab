from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from sqlalchemy import URL, MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# URL.create экранирует спецсимволы в пароле (@, /, % и т.д.)
# синхронный драйвер — для Alembic и Django-админки
DB_URL = URL.create(
    "postgresql+psycopg2",
    username=settings.DB_USER,
    password=settings.DB_PASSWORD,
    host=settings.DB_HOST,
    port=settings.DB_PORT,
    database=settings.DB_NAME,
)
# асинхронный драйвер — для FastAPI
ASYNC_DB_URL = DB_URL.set(drivername="postgresql+asyncpg")

engine = create_async_engine(ASYNC_DB_URL)

# expire_on_commit=False: после commit объекты остаются читаемыми без нового запроса
# (в async ленивая подгрузка атрибутов невозможна)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

# Имена констрейнтов предсказуемые — иначе Alembic не сможет их удалять/менять
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


db_dep = Annotated[AsyncSession, Depends(get_db)]
