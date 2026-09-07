import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.exhibit import Device, Scene, SceneDevice
from app.services.ws_manager import ws_manager
from app.services.log_service import write_log


async def _device_codes_by_scene(db: AsyncSession, scene_id: uuid.UUID) -> List[str]:
    result = await db.execute(
        select(Device.unique_code)
        .join(SceneDevice, SceneDevice.device_id == Device.id)
        .where(SceneDevice.scene_id == scene_id)
    )
    return [row[0] for row in result.all()]


async def _scene_id_of_device(db: AsyncSession, device_code: str) -> Optional[uuid.UUID]:
    result = await db.execute(select(Device.current_scene_id).where(Device.unique_code == device_code))
    return result.scalar_one_or_none()


async def resolve_target_devices(db: AsyncSession, target: dict, source_device_code: str | None) -> List[str]:
    target_type = (target or {}).get("type", "self")

    if target_type == "self":
        return [source_device_code] if source_device_code else []

    if target_type == "devices":
        codes = (target or {}).get("deviceCodes") or []
        return list(codes)

    if target_type == "all":
        return ws_manager.get_online_device_codes()

    if target_type == "scene":
        scene_id = (target or {}).get("sceneId")
        if not scene_id:
            if not source_device_code:
                return []
            scene_id = await _scene_id_of_device(db, source_device_code)
        if not scene_id:
            return []
        return await _device_codes_by_scene(db, scene_id)

    return []


async def dispatch_action(db: AsyncSession, message: dict) -> dict:
    source = message.get("source", "player")
    source_device_code = message.get("sourceDeviceCode")
    action = message.get("action", "")
    params = message.get("params") or {}
    target = message.get("target") or {}

    if action == "switchScene":
        scene_id = params.get("sceneId")
        if not scene_id:
            scene_id = target.get("sceneId")
        if not scene_id and source_device_code:
            scene_id = await _scene_id_of_device(db, source_device_code)
        if target.get("type") == "devices":
            device_codes = list(target.get("deviceCodes") or [])
        else:
            device_codes = await _device_codes_by_scene(db, scene_id) if scene_id else []
        if scene_id and device_codes:
            result = await db.execute(select(Device).where(Device.unique_code.in_(device_codes)))
            for dev in result.scalars().all():
                dev.current_scene_id = scene_id
            await db.commit()
    else:
        device_codes = await resolve_target_devices(db, target, source_device_code)

    server_message = {"type": "server:command", "action": action, "params": params}
    delivered = await ws_manager.broadcast_to_devices(device_codes, server_message)

    await write_log(
        db, "info", "device",
        f"跨设备指令分发: {action} (来源: {source}, 目标: {len(device_codes)} 台, 投递: {delivered})",
        detail={"action": action, "target": target, "source": source,
                "source_device_code": source_device_code, "device_codes": device_codes}
    )

    return {
        "action": action,
        "target_device_codes": device_codes,
        "delivered": delivered,
    }
