import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.project import ProgramCreate, ProgramCopy, ConfigSave
from app.services import project_service as ps
from app.services.auth_service import get_current_user
from app.services.log_service import write_log
from app.utils.response import success_response

router = APIRouter(tags=["项目管理"])


@router.post("/programs")
async def new_program(data: ProgramCreate, request: Request, db: AsyncSession = Depends(get_db),
                      current_user=Depends(get_current_user)):
    program = await ps.create_program(db, {
        "device_id": uuid.UUID(data.device_id), "scene_id": uuid.UUID(data.scene_id),
        "exhibit_id": uuid.UUID(data.exhibit_id), "name": data.name
    }, current_user.id)
    await write_log(db, "success", "editor", f"用户 {current_user.username} 创建节目 {program.name}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"id": str(program.id), "name": program.name})


@router.get("/programs")
async def list_programs(exhibit_id: str | None = None, device_id: str | None = None,
                        scene_id: str | None = None, status: str | None = None,
                        keyword: str | None = None, page: int = 1, page_size: int = 20,
                        db: AsyncSession = Depends(get_db)):
    filters = {k: v for k, v in {"exhibit_id": exhibit_id, "device_id": device_id,
                                  "scene_id": scene_id, "status": status, "keyword": keyword,
                                  "page": page, "page_size": page_size}.items() if v}
    programs = await ps.get_programs_list(db, filters)
    total = await ps.count_programs(db, {k: v for k, v in filters.items() if k not in ("page", "page_size")})
    return success_response({"items": programs, "total": total, "page": page, "page_size": page_size})


@router.get("/programs/{program_id}")
async def get_program(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    program = await ps.get_program_detail(db, program_id)
    return success_response(program)


@router.post("/programs/{program_id}/copy")
async def copy_program(program_id: uuid.UUID, data: ProgramCopy, request: Request,
                       db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    target_ids = [uuid.UUID(did) for did in data.target_device_ids]
    programs = await ps.copy_program(db, program_id, target_ids, current_user.id)
    await write_log(db, "success", "editor", f"用户 {current_user.username} 复制节目到 {len(programs)} 个设备",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response([{"id": str(p.id), "name": p.name} for p in programs])


@router.delete("/programs/{program_id}")
async def remove_program(program_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db),
                         current_user=Depends(get_current_user)):
    await ps.delete_program(db, program_id)
    await write_log(db, "info", "editor", f"用户 {current_user.username} 删除节目 {program_id}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response(message="节目已删除")


@router.get("/programs/{program_id}/status")
async def program_status(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    program = await ps.get_program_detail(db, program_id)
    return success_response({"publish_status": program["publish_status"], "current_version": program["current_version"],
                             "published_version": program["published_version"]})


@router.put("/programs/{program_id}/config")
async def save_config(program_id: uuid.UUID, data: ConfigSave, request: Request,
                      db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    program = await ps.update_config(db, program_id, data.config)
    await write_log(db, "info", "editor", f"用户 {current_user.username} 保存节目配置 v{program.current_version}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"current_version": program.current_version})
