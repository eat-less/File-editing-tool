import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.log_service import get_logs as get_logs_svc, get_log_statistics, write_log
from app.services.auth_service import get_current_user
from app.utils.response import success_response

router = APIRouter(tags=["系统日志"])


@router.get("/logs")
async def list_logs(log_type: str | None = None, module: str | None = None,
                    keyword: str | None = None, start_time: str | None = None,
                    end_time: str | None = None, page: int = 1, page_size: int = 20,
                    db: AsyncSession = Depends(get_db)):
    result = await get_logs_svc(db, log_type, module, None, keyword, start_time, end_time, page, page_size)
    return success_response(result)


@router.get("/logs/statistics")
async def log_statistics(db: AsyncSession = Depends(get_db)):
    result = await get_log_statistics(db)
    return success_response(result)


@router.get("/logs/{log_id}")
async def get_log_detail(log_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.models.system_log import SystemLog
    result = await db.execute(select(SystemLog).where(SystemLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        return success_response(None, message="日志不存在")
    return success_response({
        "id": str(log.id), "log_type": log.log_type, "module": log.module,
        "message": log.message, "detail": log.detail, "solution": log.solution,
        "duration_ms": log.duration_ms, "ip_address": log.ip_address,
        "created_at": log.created_at.isoformat() if log.created_at else None
    })
