import uuid
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.exhibit import ExhibitCreate, ExhibitUpdate, SceneCreate, SceneUpdate, DeviceCreate, DeviceUpdate
from app.services import project_service as ps
from app.services.auth_service import get_current_user
from app.services.log_service import write_log
from app.utils.response import success_response, error_response

router = APIRouter(tags=["展项管理"])


@router.get("/exhibits")
async def list_exhibits(db: AsyncSession = Depends(get_db)):
    exhibits = await ps.get_exhibits(db)
    return success_response(exhibits)


@router.post("/exhibits")
async def new_exhibit(data: ExhibitCreate, request: Request, db: AsyncSession = Depends(get_db),
                      current_user=Depends(get_current_user)):
    exhibit = await ps.create_exhibit(db, data.name, data.description, current_user.id)
    await write_log(db, "success", "exhibit", f"用户 {current_user.username} 创建展项 {exhibit.name}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"id": str(exhibit.id), "name": exhibit.name})


@router.put("/exhibits/{exhibit_id}")
async def edit_exhibit(exhibit_id: uuid.UUID, data: ExhibitUpdate, request: Request,
                       db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    exhibit = await ps.update_exhibit(db, exhibit_id, data.name, data.description)
    await write_log(db, "info", "exhibit", f"用户 {current_user.username} 更新展项 {exhibit.name}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"id": str(exhibit.id), "name": exhibit.name})


@router.delete("/exhibits/{exhibit_id}")
async def remove_exhibit(exhibit_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db),
                         current_user=Depends(get_current_user)):
    await ps.delete_exhibit(db, exhibit_id)
    await write_log(db, "info", "exhibit", f"用户 {current_user.username} 删除展项 {exhibit_id}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response(message="展项已删除")


@router.get("/exhibits/{exhibit_id}/scenes")
async def list_scenes(exhibit_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    scenes = await ps.get_scenes(db, exhibit_id)
    return success_response(scenes)


@router.post("/exhibits/{exhibit_id}/scenes")
async def new_scene(exhibit_id: uuid.UUID, data: SceneCreate, request: Request,
                    db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    scene = await ps.create_scene(db, exhibit_id, data.name, data.description, data.sort_order)
    await write_log(db, "success", "exhibit", f"用户 {current_user.username} 创建场景 {scene.name}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"id": str(scene.id), "name": scene.name})


@router.put("/scenes/{scene_id}")
async def edit_scene(scene_id: uuid.UUID, data: SceneUpdate, request: Request,
                     db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    scene = await ps.update_scene(db, scene_id, data.model_dump(exclude_none=True))
    await write_log(db, "info", "exhibit", f"用户 {current_user.username} 更新场景 {scene.name}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"id": str(scene.id), "name": scene.name})


@router.delete("/scenes/{scene_id}")
async def remove_scene(scene_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db),
                       current_user=Depends(get_current_user)):
    await ps.delete_scene(db, scene_id)
    await write_log(db, "info", "exhibit", f"用户 {current_user.username} 删除场景 {scene_id}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response(message="场景已删除")


@router.get("/scenes/{scene_id}/devices")
async def list_devices(scene_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    devices = await ps.get_devices(db, scene_id)
    return success_response([{
        "id": str(d.id), "scene_id": str(d.scene_id), "exhibit_id": str(d.exhibit_id),
        "name": d.name, "device_type": d.device_type, "unique_code": d.unique_code,
        "ip_address": d.ip_address, "config_file_path": d.config_file_path,
        "design_width": d.design_width, "design_height": d.design_height,
        "status": d.status, "last_online": d.last_online.isoformat() if d.last_online else None,
        "created_at": d.created_at.isoformat() if d.created_at else None
    } for d in devices])


@router.post("/scenes/{scene_id}/devices")
async def new_device(scene_id: uuid.UUID, data: DeviceCreate, request: Request,
                     db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    device = await ps.create_device(db, scene_id, data.model_dump(exclude_none=True))
    await write_log(db, "success", "device", f"用户 {current_user.username} 添加设备 {device.name}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"id": str(device.id), "name": device.name, "unique_code": device.unique_code})


@router.put("/devices/{device_id}")
async def edit_device(device_id: uuid.UUID, data: DeviceUpdate, request: Request,
                      db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    device = await ps.update_device(db, device_id, data.model_dump(exclude_none=True))
    await write_log(db, "info", "device", f"用户 {current_user.username} 更新设备 {device.name}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response({"id": str(device.id), "name": device.name})


@router.delete("/devices/{device_id}")
async def remove_device(device_id: uuid.UUID, request: Request, db: AsyncSession = Depends(get_db),
                        current_user=Depends(get_current_user)):
    await ps.delete_device(db, device_id)
    await write_log(db, "info", "device", f"用户 {current_user.username} 删除设备 {device_id}",
                    operator_id=current_user.id, ip_address=request.client.host if request.client else None)
    return success_response(message="设备已删除")


@router.get("/devices/{device_id}/status")
async def get_device_status(device_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    from app.services.ws_manager import ws_manager
    from app.models.exhibit import Device
    from sqlalchemy import select
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        return error_response("设备不存在", code=404)
    realtime_status = ws_manager.get_device_status(device.unique_code)
    return success_response({"device_id": str(device.id), "status": realtime_status})
