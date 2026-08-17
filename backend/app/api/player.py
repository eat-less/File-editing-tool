from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.exhibit import Device
from app.models.project import Program, Asset
from app.models.distribution import VersionSnapshot
from app.services.asset_service import collect_asset_hashes
from app.utils.response import success_response

router = APIRouter(tags=["播放器"])


@router.get("/player/{device_code}/sync")
async def device_sync(device_code: str, db: AsyncSession = Depends(get_db)):
    """设备端拉取最新已发布节目配置与素材清单（播放器无登录，直接按设备编码查询）"""
    result = await db.execute(select(Device).where(Device.unique_code == device_code))
    device = result.scalar_one_or_none()
    if not device:
        return success_response({"published": False, "reason": "device_not_found"})

    prog_result = await db.execute(select(Program).where(Program.device_id == device.id))
    program = prog_result.scalar_one_or_none()
    if not program or program.published_version <= 0:
        return success_response({"published": False, "reason": "no_published_program"})

    snap_result = await db.execute(
        select(VersionSnapshot).where(
            VersionSnapshot.program_id == program.id,
            VersionSnapshot.version == program.published_version,
        )
    )
    snapshot = snap_result.scalar_one_or_none()

    config = snapshot.config_snapshot if snapshot and snapshot.config_snapshot else program.config

    hashes = collect_asset_hashes(config)
    assets = []
    if hashes:
        asset_rows = (await db.execute(select(Asset).where(Asset.hash_key.in_(hashes)))).scalars().all()
        assets = [{
            "hash_key": a.hash_key,
            "original_name": a.original_name,
            "file_size": a.file_size,
            "mime_type": a.mime_type,
            "file_type": a.file_type,
        } for a in asset_rows]

    return success_response({
        "published": True,
        "program_id": str(program.id),
        "program_name": program.name,
        "version": program.published_version,
        "config": config,
        "assets": assets,
        "device": {
            "unique_code": device.unique_code,
            "name": device.name,
            "design_width": device.design_width,
            "design_height": device.design_height,
        },
    })
