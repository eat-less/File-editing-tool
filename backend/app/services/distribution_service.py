import uuid
import json
import os
import asyncio
import shutil
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.config import settings
from app.models.project import Program
from app.models.exhibit import Device, Exhibit, Scene
from app.models.distribution import VersionSnapshot, DistributionLog
from app.services.asset_service import update_reference_counts
from app.services.ws_manager import ws_manager
from app.utils.minio_utils import upload_json
from app.utils.path_utils import make_device_dir, make_publish_dir, make_page_dir, make_minio_prefix


async def publish_program(db: AsyncSession, program_id: uuid.UUID, change_note: str, operator_id: uuid.UUID | None) -> dict:
    if not change_note or not change_note.strip():
        raise HTTPException(status_code=400, detail="变更说明不能为空")
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="节目不存在")

    ex_result = await db.execute(select(Exhibit).where(Exhibit.id == program.exhibit_id))
    exhibit = ex_result.scalar_one_or_none()
    sc_result = await db.execute(select(Scene).where(Scene.id == program.scene_id))
    scene = sc_result.scalar_one_or_none()
    dev_result = await db.execute(select(Device).where(Device.id == program.device_id))
    device = dev_result.scalar_one_or_none()

    exhibit_name = exhibit.name if exhibit else "未分类展项"
    scene_name = scene.name if scene else "未分类场景"
    device_name = device.name if device else str(program.device_id)

    version = program.current_version
    config_snapshot = program.config
    manifest = {"version": version, "change_note": change_note, "created_at": datetime.now(timezone.utc).isoformat()}

    loop = asyncio.get_running_loop()
    minio_prefix = make_minio_prefix(exhibit_name, scene_name, device_name)

    await loop.run_in_executor(None, upload_json, f"{minio_prefix}/总配置.json", config_snapshot)
    await loop.run_in_executor(None, upload_json, f"{minio_prefix}/版本.json", {
        "current_version": program.current_version,
        "published_version": version,
        "publish_status": "published",
    })

    pages = config_snapshot.get("pages", [])
    for page in pages:
        page_name = page.get("name") or page.get("id", f"page_{pages.index(page)}")
        await loop.run_in_executor(None, upload_json,
            f"{minio_prefix}/当前工作区/{page_name}/config.json", page)

    await loop.run_in_executor(None, upload_json, f"{minio_prefix}/当前工作区/发布清单.json", manifest)

    publish_dir = os.path.join(settings.STORAGE_ROOT,
        make_publish_dir(exhibit_name, scene_name, device_name, version))
    os.makedirs(publish_dir, exist_ok=True)

    total_path = os.path.join(publish_dir, "总配置.json")
    with open(total_path, "w", encoding="utf-8") as f:
        json.dump(config_snapshot, f, ensure_ascii=False)

    manifest_path = os.path.join(publish_dir, "发布清单.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)

    for page in pages:
        page_name = page.get("name") or page.get("id", f"page_{pages.index(page)}")
        page_publish_path = os.path.join(publish_dir, f"{page_name}_config.json")
        with open(page_publish_path, "w", encoding="utf-8") as f:
            json.dump(page, f, ensure_ascii=False)

    program.published_version = version
    program.publish_status = "published"
    snapshot = VersionSnapshot(
        program_id=program_id, version=version, change_note=change_note,
        config_snapshot=config_snapshot, manifest=manifest, operator_id=operator_id
    )
    db.add(snapshot)
    dist_log = DistributionLog(
        program_id=program_id, device_id=program.device_id, version=version,
        change_note=change_note, operator_id=operator_id, action="publish", status="synced"
    )
    db.add(dist_log)
    await update_reference_counts(db, config_snapshot)
    await db.commit()
    await db.refresh(program)
    if device:
        await ws_manager.broadcast_to_device(device.unique_code, {
            "type": "server:update", "program_id": str(program_id),
            "version": version, "manifest": manifest
        })
    return {"version": version, "change_note": change_note, "manifest": manifest}


async def publish_all_scene(db: AsyncSession, scene_id: uuid.UUID, change_note: str, operator_id: uuid.UUID | None) -> dict:
    result = await db.execute(select(Program).where(Program.scene_id == scene_id))
    programs = list(result.scalars().all())
    results = []
    for prog in programs:
        try:
            r = await publish_program(db, prog.id, change_note, operator_id)
            results.append({"program_id": str(prog.id), "status": "success", **r})
        except Exception as e:
            results.append({"program_id": str(prog.id), "status": "failed", "error": str(e)})
    return {"results": results}


async def get_version_history(db: AsyncSession, program_id: uuid.UUID) -> list[VersionSnapshot]:
    result = await db.execute(
        select(VersionSnapshot).where(VersionSnapshot.program_id == program_id).order_by(VersionSnapshot.version.desc())
    )
    return list(result.scalars().all())


async def rollback_program(db: AsyncSession, program_id: uuid.UUID, version: int, rollback_reason: str, operator_id: uuid.UUID | None) -> dict:
    result = await db.execute(
        select(VersionSnapshot).where(VersionSnapshot.program_id == program_id, VersionSnapshot.version == version)
    )
    snapshot = result.scalar_one_or_none()
    if not snapshot:
        raise HTTPException(status_code=404, detail="版本不存在")
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="节目不存在")

    ex_result = await db.execute(select(Exhibit).where(Exhibit.id == program.exhibit_id))
    exhibit = ex_result.scalar_one_or_none()
    sc_result = await db.execute(select(Scene).where(Scene.id == program.scene_id))
    scene = sc_result.scalar_one_or_none()
    dev_result = await db.execute(select(Device).where(Device.id == program.device_id))
    device = dev_result.scalar_one_or_none()
    exhibit_name = exhibit.name if exhibit else "未分类展项"
    scene_name = scene.name if scene else "未分类场景"
    device_name = device.name if device else str(program.device_id)

    new_version = program.current_version + 1
    program.config = snapshot.config_snapshot
    program.current_version = new_version
    program.published_version = new_version
    program.publish_status = "published"
    change_note = f"回滚至v{version}: {rollback_reason}"
    manifest = {"version": new_version, "change_note": change_note, "rollback_from": version, "rollback_reason": rollback_reason}

    loop = asyncio.get_running_loop()
    minio_prefix = make_minio_prefix(exhibit_name, scene_name, device_name)
    await loop.run_in_executor(None, upload_json, f"{minio_prefix}/总配置.json", program.config)
    await loop.run_in_executor(None, upload_json, f"{minio_prefix}/版本.json", {
        "current_version": new_version,
        "published_version": version,
        "publish_status": "published",
    })
    await loop.run_in_executor(None, upload_json, f"{minio_prefix}/当前工作区/发布清单.json", manifest)

    publish_dir = os.path.join(settings.STORAGE_ROOT,
        make_publish_dir(exhibit_name, scene_name, device_name, new_version))
    os.makedirs(publish_dir, exist_ok=True)
    total_path = os.path.join(publish_dir, "总配置.json")
    with open(total_path, "w", encoding="utf-8") as f:
        json.dump(program.config, f, ensure_ascii=False)

    new_snapshot = VersionSnapshot(
        program_id=program_id, version=new_version, change_note=change_note,
        config_snapshot=program.config, manifest=manifest, operator_id=operator_id
    )
    db.add(new_snapshot)
    dist_log = DistributionLog(
        program_id=program_id, device_id=program.device_id, version=new_version,
        change_note=change_note, operator_id=operator_id, action="rollback", status="synced"
    )
    db.add(dist_log)
    await db.commit()
    await db.refresh(program)
    if device:
        await ws_manager.broadcast_to_device(device.unique_code, {
            "type": "server:update", "program_id": str(program_id),
            "version": new_version, "manifest": manifest
        })
    return {"version": new_version, "change_note": change_note}


async def get_distribution_status(db: AsyncSession, program_id: uuid.UUID) -> list[DistributionLog]:
    result = await db.execute(
        select(DistributionLog).where(DistributionLog.program_id == program_id).order_by(DistributionLog.started_at.desc())
    )
    return list(result.scalars().all())


async def get_distribution_logs(db: AsyncSession, filters: dict) -> list[DistributionLog]:
    q = select(DistributionLog)
    if filters.get("action"):
        q = q.where(DistributionLog.action == filters["action"])
    q = q.order_by(DistributionLog.started_at.desc())
    if filters.get("page") and filters.get("page_size"):
        offset = (filters["page"] - 1) * filters["page_size"]
        q = q.offset(offset).limit(filters["page_size"])
    result = await db.execute(q)
    return list(result.scalars().all())
