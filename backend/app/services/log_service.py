import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.system_log import SystemLog


PRESET_SOLUTIONS = {
    "minio_connection_failed": "检查MinIO服务是否运行，确认端口9000/9001是否开放，检查access key是否正确",
    "device_offline": "检查设备网络连接，确认设备已开机并连接到服务器，可尝试重启设备",
    "upload_failed": "检查文件大小是否超限（上限500MB），检查磁盘空间是否充足，确认文件格式受支持",
    "exhibit_delete_blocked": "请先删除该展项下的所有场景和设备，或使用级联删除确认弹窗",
    "rollback_failed": "确认目标版本存在且素材完整，如有文件丢失需先补传缺失素材",
    "sequence_load_failed": "检查帧文件夹中是否包含有效图片文件，确认文件命名规范一致，检查帧率设置是否合理",
}


async def write_log(db: AsyncSession, log_type: str, module: str, message: str,
                    operator_id: uuid.UUID | None = None, detail: dict | None = None,
                    solution: str | None = None, duration_ms: int | None = None,
                    ip_address: str | None = None) -> SystemLog:
    log = SystemLog(
        log_type=log_type, module=module, message=message,
        operator_id=operator_id, detail=detail, solution=solution,
        duration_ms=duration_ms, ip_address=ip_address
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    try:
        from app.services.ws_manager import ws_manager
        await ws_manager.broadcast_to_admins({"type": "log:new", "log": {
            "id": str(log.id), "log_type": log.log_type, "module": log.module,
            "message": log.message, "detail": log.detail, "solution": log.solution,
            "duration_ms": log.duration_ms, "created_at": log.created_at.isoformat() if log.created_at else None
        }})
    except Exception:
        pass
    return log


async def get_logs(db: AsyncSession, log_type: str | None = None, module: str | None = None,
                   operator_id: str | None = None, keyword: str | None = None,
                   start_time: str | None = None, end_time: str | None = None,
                   page: int = 1, page_size: int = 20) -> dict:
    conditions = []
    if log_type:
        conditions.append(SystemLog.log_type == log_type)
    if module:
        conditions.append(SystemLog.module == module)
    if keyword:
        conditions.append(SystemLog.message.ilike(f"%{keyword}%"))
    q = select(SystemLog)
    count_q = select(func.count(SystemLog.id))
    if conditions:
        q = q.where(and_(*conditions))
        count_q = count_q.where(and_(*conditions))
    q = q.order_by(SystemLog.created_at.desc())
    total = (await db.execute(count_q)).scalar() or 0
    offset = (page - 1) * page_size
    q = q.offset(offset).limit(page_size)
    result = await db.execute(q)
    logs = list(result.scalars().all())
    items = []
    for log in logs:
        items.append({
            "id": log.id, "log_type": log.log_type, "module": log.module,
            "message": log.message, "detail": log.detail, "solution": log.solution,
            "duration_ms": log.duration_ms, "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None
        })
    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_log_statistics(db: AsyncSession) -> dict:
    type_result = await db.execute(
        select(SystemLog.log_type, func.count(SystemLog.id)).group_by(SystemLog.log_type)
    )
    module_result = await db.execute(
        select(SystemLog.module, func.count(SystemLog.id)).group_by(SystemLog.module)
    )
    return {
        "by_type": [{"type": t, "count": c} for t, c in type_result.all()],
        "by_module": [{"module": m, "count": c} for m, c in module_result.all()]
    }
