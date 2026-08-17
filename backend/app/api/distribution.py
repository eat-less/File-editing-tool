import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.distribution import PublishRequest, PublishAllRequest, RollbackRequest
from app.services.auth_service import get_current_user
from app.services import distribution_service as ds
from app.services.log_service import write_log
from app.utils.response import success_response

router = APIRouter(tags=["分发管理"])


@router.post("/programs/{program_id}/publish")
async def publish(program_id: uuid.UUID, data: PublishRequest, request: Request,
                  db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await ds.publish_program(db, program_id, data.change_note, current_user.id)
    await write_log(db, "success", "distribution", f"用户 {current_user.username} 发布节目 v{result['version']}",
                    operator_id=current_user.id, detail={"change_note": data.change_note},
                    ip_address=request.client.host if request.client else None)
    return success_response(result)


@router.post("/scenes/{scene_id}/publish-all")
async def publish_all(scene_id: uuid.UUID, data: PublishAllRequest, request: Request,
                      db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await ds.publish_all_scene(db, scene_id, data.change_note, current_user.id)
    await write_log(db, "success", "distribution", f"用户 {current_user.username} 一键发布场景",
                    operator_id=current_user.id, detail={"scene_id": str(scene_id)},
                    ip_address=request.client.host if request.client else None)
    return success_response(result)


@router.get("/programs/{program_id}/versions")
async def get_versions(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    versions = await ds.get_version_history(db, program_id)
    return success_response([{
        "id": str(v.id), "version": v.version, "change_note": v.change_note,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "operator_id": str(v.operator_id) if v.operator_id else None
    } for v in versions])


@router.get("/programs/{program_id}/versions/{version}")
async def get_version(program_id: uuid.UUID, version: int, db: AsyncSession = Depends(get_db)):
    versions = await ds.get_version_history(db, program_id)
    for v in versions:
        if v.version == version:
            return success_response({
                "id": str(v.id), "version": v.version, "change_note": v.change_note,
                "config_snapshot": v.config_snapshot, "manifest": v.manifest,
                "created_at": v.created_at.isoformat() if v.created_at else None
            })
    return success_response(None, message="版本不存在")


@router.post("/programs/{program_id}/rollback")
async def rollback(program_id: uuid.UUID, data: RollbackRequest, request: Request,
                   db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await ds.rollback_program(db, program_id, data.version, data.rollback_reason, current_user.id)
    await write_log(db, "success", "distribution", f"用户 {current_user.username} 回滚节目至 v{data.version}",
                    operator_id=current_user.id, detail={"version": data.version, "reason": data.rollback_reason},
                    ip_address=request.client.host if request.client else None)
    return success_response(result)


@router.get("/programs/{program_id}/distribution")
async def get_distribution(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    logs = await ds.get_distribution_status(db, program_id)
    return success_response([{
        "id": str(l.id), "program_id": str(l.program_id), "device_id": str(l.device_id),
        "version": l.version, "action": l.action, "status": l.status,
        "change_note": l.change_note, "started_at": l.started_at.isoformat() if l.started_at else None,
        "completed_at": l.completed_at.isoformat() if l.completed_at else None,
        "error_message": l.error_message
    } for l in logs])


@router.get("/distribution/logs")
async def get_distribution_logs(action: str | None = None, page: int = 1, page_size: int = 20,
                                db: AsyncSession = Depends(get_db)):
    filters = {k: v for k, v in {"action": action, "page": page, "page_size": page_size}.items() if v}
    logs = await ds.get_distribution_logs(db, filters)
    return success_response([{
        "id": str(l.id), "program_id": str(l.program_id), "device_id": str(l.device_id),
        "version": l.version, "action": l.action, "status": l.status,
        "change_note": l.change_note, "started_at": l.started_at.isoformat() if l.started_at else None,
        "completed_at": l.completed_at.isoformat() if l.completed_at else None
    } for l in logs])
