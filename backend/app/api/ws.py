import json
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, update
from app.config import settings
from app.database import async_session_factory
from app.models.exhibit import Device
from app.models.project import Program
from app.models.distribution import DistributionLog
from app.services.ws_manager import ws_manager
from app.services.control_service import dispatch_action
from app.services.log_service import write_log

router = APIRouter(tags=["WebSocket"])


async def _sync_device(db, device_code: str, online: bool, ip_address: str | None = None):
    now = datetime.now(timezone.utc)
    values = {
        "status": "online" if online else "offline",
        "last_online": now if online else None,
    }
    if ip_address:
        values["ip_address"] = ip_address
    await db.execute(update(Device).where(Device.unique_code == device_code).values(**values))
    await db.commit()


async def _update_distribution_log(db, device_code: str, program_id: str, version: int | None,
                                   status: str, error_message: str | None = None):
    dev_result = await db.execute(select(Device).where(Device.unique_code == device_code))
    device = dev_result.scalar_one_or_none()
    if not device:
        return
    q = select(DistributionLog).where(
        DistributionLog.device_id == device.id,
        DistributionLog.program_id == program_id,
    ).order_by(DistributionLog.started_at.desc())
    if version is not None:
        q = q.where(DistributionLog.version == version)
    log_row = (await db.execute(q)).scalars().first()
    if not log_row:
        return
    log_row.status = status
    if status == "synced":
        log_row.completed_at = datetime.now(timezone.utc)
    if status == "syncing":
        log_row.completed_at = None
    if error_message:
        log_row.error_message = error_message
    await db.commit()


@router.websocket("/ws/device/{device_code}")
async def device_websocket(websocket: WebSocket, device_code: str):
    await ws_manager.connect_device(device_code, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                mtype = msg.get("type")
                if mtype == "device:register":
                    ip = msg.get("ip_address")
                    async with async_session_factory() as db:
                        await _sync_device(db, device_code, True, ip)
                        await write_log(
                            db, "info", "device",
                            f"设备 {device_code} 上线注册 (IP: {ip or '未知'})",
                            detail={"device_code": device_code, "ip_address": ip}
                        )
                    await ws_manager.broadcast_to_controls({
                        "type": "deviceStatus", "deviceCode": device_code, "online": True
                    })
                elif mtype == "device:heartbeat":
                    async with async_session_factory() as db:
                        await _sync_device(db, device_code, True)
                elif mtype == "device:sync_status":
                    async with async_session_factory() as db:
                        await _update_distribution_log(
                            db, device_code, msg.get("program_id"), msg.get("version"),
                            "syncing"
                        )
                elif mtype == "device:sync_done":
                    async with async_session_factory() as db:
                        await _update_distribution_log(
                            db, device_code, msg.get("program_id"), msg.get("version"),
                            "synced"
                        )
                        await write_log(
                            db, "success", "distribution",
                            f"设备 {device_code} 同步完成 v{msg.get('version')}",
                            detail={"program_id": msg.get("program_id"), "version": msg.get("version")}
                        )
                elif mtype == "deviceAction":
                    msg["source"] = msg.get("source", "player")
                    msg["sourceDeviceCode"] = msg.get("sourceDeviceCode") or device_code
                    async with async_session_factory() as db:
                        await dispatch_action(db, msg)
                elif mtype == "deviceStatus":
                    await ws_manager.broadcast_to_controls({
                        "type": "deviceStatus",
                        "deviceCode": device_code,
                        "online": True,
                        "currentPage": msg.get("currentPage"),
                        "currentScene": msg.get("currentScene"),
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        await _on_device_disconnect(device_code)
    except Exception:
        await _on_device_disconnect(device_code)


async def _on_device_disconnect(device_code: str):
    ws_manager.disconnect_device(device_code)
    try:
        async with async_session_factory() as db:
            await _sync_device(db, device_code, False)
            await write_log(
                db, "warning", "device",
                f"设备 {device_code} 离线", detail={"device_code": device_code},
                solution="检查设备网络连接，确认设备已开机并连接到服务器，可尝试重启设备"
            )
    except Exception:
        pass
    await ws_manager.broadcast_to_controls({"type": "deviceStatus", "deviceCode": device_code, "online": False})


@router.websocket("/ws/control")
async def control_websocket(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if token != settings.CONTROL_API_TOKEN:
        await websocket.close(code=1008)
        return
    await ws_manager.connect_control(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "deviceAction":
                    msg["source"] = msg.get("source", "central_control")
                    async with async_session_factory() as db:
                        result = await dispatch_action(db, msg)
                    await ws_manager.broadcast_to_controls({
                        "type": "commandAck",
                        "action": result["action"],
                        "delivered": result["delivered"],
                        "target_device_codes": result["target_device_codes"],
                    })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect_control(websocket)
    except Exception:
        ws_manager.disconnect_control(websocket)


@router.websocket("/ws/logs")
async def logs_websocket(websocket: WebSocket):
    await ws_manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect_admin(websocket)
    except Exception:
        ws_manager.disconnect_admin(websocket)
