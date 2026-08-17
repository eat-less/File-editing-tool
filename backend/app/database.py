from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, pool_size=20, max_overflow=10, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    from app.models.user import User
    from app.models.exhibit import Exhibit, Scene, Device
    from app.models.project import Program, Asset
    from app.models.distribution import VersionSnapshot, DistributionLog
    from app.models.system_log import SystemLog
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
