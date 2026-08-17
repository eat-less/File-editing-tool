import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.api import auth, exhibit, project, editor, asset, distribution, ws, player, log as log_api
from app.services.auth_service import get_user_by_username, create_user as create_user_svc
from app.utils.minio_utils import ensure_bucket


async def ensure_directories():
    os.makedirs(settings.STORAGE_ROOT, exist_ok=True)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    programs_dir = os.path.join(settings.STORAGE_ROOT, "programs")
    os.makedirs(programs_dir, exist_ok=True)


async def create_default_admin():
    from app.database import async_session_factory
    async with async_session_factory() as db:
        admin = await get_user_by_username(db, "admin")
        if not admin:
            await create_user_svc(db, "admin", "admin123", "superadmin", created_by=None)

async def ensure_storage():
    try:
        import asyncio
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, ensure_bucket)
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    await ensure_directories()
    await init_db()
    await create_default_admin()
    await ensure_storage()
    yield


app = FastAPI(title="多媒体内容管理展示系统", version="3.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(exhibit.router, prefix="/api/v1")
app.include_router(project.router, prefix="/api/v1")
app.include_router(editor.router, prefix="/api/v1")
app.include_router(asset.router, prefix="/api/v1")
app.include_router(distribution.router, prefix="/api/v1")
app.include_router(player.router, prefix="/api/v1")
app.include_router(ws.router, prefix="/api/v1")
app.include_router(log_api.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"name": "多媒体内容管理展示系统", "version": "3.0.0"}


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
