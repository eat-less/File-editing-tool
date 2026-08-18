import os
import uuid
import json
import asyncio
import shutil
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.config import settings
from app.models.exhibit import Exhibit, Scene, Device
from app.models.project import Program
from app.utils.minio_utils import build_config_key, upload_json
from app.utils.path_utils import (
    make_device_dir,
    make_page_dir,
    make_publish_dir,
    make_minio_prefix,
)


async def get_exhibits(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(Exhibit).order_by(Exhibit.created_at.desc()))
    exhibits = list(result.scalars().all())
    data = []
    for ex in exhibits:
        scene_count_result = await db.execute(select(func.count(Scene.id)).where(Scene.exhibit_id == ex.id))
        scene_count = scene_count_result.scalar() or 0
        device_count_result = await db.execute(select(func.count(Device.id)).where(Device.exhibit_id == ex.id))
        device_count = device_count_result.scalar() or 0
        data.append({
            "id": ex.id, "name": ex.name, "description": ex.description,
            "scene_count": scene_count, "device_count": device_count,
            "created_at": ex.created_at, "updated_at": ex.updated_at
        })
    return data


async def create_exhibit(db: AsyncSession, name: str, description: str | None, creator_id: uuid.UUID | None) -> Exhibit:
    exhibit = Exhibit(name=name, description=description, creator_id=creator_id)
    db.add(exhibit)
    await db.flush()
    storage_dir = os.path.join(settings.STORAGE_ROOT, "exhibits", str(exhibit.id))
    os.makedirs(storage_dir, exist_ok=True)
    exhibit.storage_path = storage_dir
    await db.commit()
    await db.refresh(exhibit)
    return exhibit


async def update_exhibit(db: AsyncSession, exhibit_id: uuid.UUID, name: str | None, description: str | None) -> Exhibit:
    result = await db.execute(select(Exhibit).where(Exhibit.id == exhibit_id))
    exhibit = result.scalar_one_or_none()
    if not exhibit:
        raise HTTPException(status_code=404, detail="展项不存在")
    old_path = exhibit.storage_path
    if name is not None:
        exhibit.name = name
    if description is not None:
        exhibit.description = description
    if name is not None and old_path:
        new_path = os.path.join(settings.STORAGE_ROOT, "exhibits", str(exhibit.id))
        if os.path.exists(old_path) and old_path != new_path:
            os.rename(old_path, new_path)
        exhibit.storage_path = new_path
    await db.commit()
    await db.refresh(exhibit)
    return exhibit


async def delete_exhibit(db: AsyncSession, exhibit_id: uuid.UUID):
    result = await db.execute(select(Exhibit).where(Exhibit.id == exhibit_id))
    exhibit = result.scalar_one_or_none()
    if not exhibit:
        raise HTTPException(status_code=404, detail="展项不存在")
    if exhibit.storage_path and os.path.exists(exhibit.storage_path):
        shutil.rmtree(exhibit.storage_path, ignore_errors=True)
    await db.delete(exhibit)
    await db.commit()


async def get_scenes(db: AsyncSession, exhibit_id: uuid.UUID) -> list[dict]:
    result = await db.execute(select(Scene).where(Scene.exhibit_id == exhibit_id).order_by(Scene.sort_order))
    scenes = list(result.scalars().all())
    data = []
    for sc in scenes:
        device_count_result = await db.execute(select(func.count(Device.id)).where(Device.scene_id == sc.id))
        device_count = device_count_result.scalar() or 0
        data.append({
            "id": sc.id, "exhibit_id": sc.exhibit_id, "name": sc.name,
            "description": sc.description, "sort_order": sc.sort_order,
            "device_count": device_count, "created_at": sc.created_at
        })
    return data


async def create_scene(db: AsyncSession, exhibit_id: uuid.UUID, name: str, description: str | None, sort_order: int) -> Scene:
    ex_result = await db.execute(select(Exhibit).where(Exhibit.id == exhibit_id))
    if not ex_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="展项不存在")
    scene = Scene(exhibit_id=exhibit_id, name=name, description=description, sort_order=sort_order)
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


async def update_scene(db: AsyncSession, scene_id: uuid.UUID, data: dict) -> Scene:
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="场景不存在")
    for key, value in data.items():
        if value is not None:
            setattr(scene, key, value)
    await db.commit()
    await db.refresh(scene)
    return scene


async def delete_scene(db: AsyncSession, scene_id: uuid.UUID):
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="场景不存在")
    await db.delete(scene)
    await db.commit()


async def get_devices(db: AsyncSession, scene_id: uuid.UUID) -> list[Device]:
    result = await db.execute(select(Device).where(Device.scene_id == scene_id).order_by(Device.created_at.desc()))
    return list(result.scalars().all())


async def create_device(db: AsyncSession, scene_id: uuid.UUID, data: dict) -> Device:
    sc_result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = sc_result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail="场景不存在")
    unique_code = data.get("unique_code") or f"DEV-{uuid.uuid4().hex[:8].upper()}"
    existing = await db.execute(select(Device).where(Device.unique_code == unique_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="设备唯一编号已存在")
    device = Device(
        scene_id=scene_id, exhibit_id=scene.exhibit_id, name=data["name"],
        device_type=data.get("device_type", "pc"),
        unique_code=unique_code,
        ip_address=data.get("ip_address"),
        design_width=data.get("design_width", 1920),
        design_height=data.get("design_height", 1080)
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


async def update_device(db: AsyncSession, device_id: uuid.UUID, data: dict) -> Device:
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    new_code = data.get("unique_code")
    if new_code and new_code != device.unique_code:
        existing = await db.execute(select(Device).where(Device.unique_code == new_code))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="设备唯一编号已存在")
    for key, value in data.items():
        if value is not None:
            setattr(device, key, value)
    await db.commit()
    await db.refresh(device)
    return device


async def delete_device(db: AsyncSession, device_id: uuid.UUID):
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    await db.delete(device)
    await db.commit()


async def get_programs_list(db: AsyncSession, filters: dict) -> list[dict]:
    q = select(Program)
    if filters.get("exhibit_id"):
        q = q.where(Program.exhibit_id == filters["exhibit_id"])
    if filters.get("device_id"):
        q = q.where(Program.device_id == filters["device_id"])
    if filters.get("scene_id"):
        q = q.where(Program.scene_id == filters["scene_id"])
    if filters.get("status"):
        q = q.where(Program.publish_status == filters["status"])
    if filters.get("keyword"):
        q = q.where(Program.name.ilike(f"%{filters['keyword']}%"))
    q = q.order_by(Program.updated_at.desc())
    if filters.get("page") and filters.get("page_size"):
        offset = (filters["page"] - 1) * filters["page_size"]
        q = q.offset(offset).limit(filters["page_size"])
    result = await db.execute(q)
    programs = list(result.scalars().all())
    data = []
    for prog in programs:
        ex_result = await db.execute(select(Exhibit).where(Exhibit.id == prog.exhibit_id))
        exhibit = ex_result.scalar_one_or_none()
        sc_result = await db.execute(select(Scene).where(Scene.id == prog.scene_id))
        scene = sc_result.scalar_one_or_none()
        dev_result = await db.execute(select(Device).where(Device.id == prog.device_id))
        device = dev_result.scalar_one_or_none()
        exhibit_name = exhibit.name if exhibit else ""
        scene_name = scene.name if scene else ""
        device_name = device.name if device else ""
        exhibit_path = f"{exhibit_name} > {scene_name} > {device_name}" if all([exhibit_name, scene_name, device_name]) else ""
        data.append({
            "id": prog.id, "device_id": prog.device_id, "scene_id": prog.scene_id,
            "exhibit_id": prog.exhibit_id, "name": prog.name, "config": prog.config,
            "current_version": prog.current_version, "published_version": prog.published_version,
            "publish_status": prog.publish_status,
            "exhibit_name": exhibit_name, "scene_name": scene_name, "device_name": device_name,
            "exhibit_path": exhibit_path,
            "created_at": prog.created_at, "updated_at": prog.updated_at
        })
    return data


async def count_programs(db: AsyncSession, filters: dict) -> int:
    q = select(func.count(Program.id))
    if filters.get("exhibit_id"):
        q = q.where(Program.exhibit_id == filters["exhibit_id"])
    if filters.get("device_id"):
        q = q.where(Program.device_id == filters["device_id"])
    if filters.get("scene_id"):
        q = q.where(Program.scene_id == filters["scene_id"])
    if filters.get("status"):
        q = q.where(Program.publish_status == filters["status"])
    if filters.get("keyword"):
        q = q.where(Program.name.ilike(f"%{filters['keyword']}%"))
    result = await db.execute(q)
    return result.scalar() or 0


async def create_program(db: AsyncSession, data: dict, creator_id: uuid.UUID | None) -> Program:
    existing = await db.execute(
        select(Program).where(Program.device_id == data["device_id"], Program.scene_id == data["scene_id"])
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该设备在该场景下已有节目")
    program = Program(
        device_id=data["device_id"], scene_id=data["scene_id"],
        exhibit_id=data["exhibit_id"], name=data["name"], creator_id=creator_id
    )
    db.add(program)
    await db.flush()

    ex_result = await db.execute(select(Exhibit).where(Exhibit.id == program.exhibit_id))
    exhibit = ex_result.scalar_one_or_none()
    sc_result = await db.execute(select(Scene).where(Scene.id == program.scene_id))
    scene = sc_result.scalar_one_or_none()
    dev_result = await db.execute(select(Device).where(Device.id == program.device_id))
    device = dev_result.scalar_one_or_none()

    program.config = {
        "pages": [],
        "device": {
            "designWidth": (device.design_width if device and device.design_width else 1920),
            "designHeight": (device.design_height if device and device.design_height else 1080),
            "name": (device.name if device else "") or "",
        },
    }

    exhibit_name = exhibit.name if exhibit else "未分类展项"
    scene_name = scene.name if scene else "未分类场景"
    device_name = device.name if device else str(program.device_id)
    device_path = os.path.join(settings.STORAGE_ROOT, make_device_dir(exhibit_name, scene_name, device_name))
    os.makedirs(device_path, exist_ok=True)
    program.storage_path = device_path

    workspace_dir = os.path.join(device_path, "当前工作区")
    os.makedirs(workspace_dir, exist_ok=True)

    total_config_path = os.path.join(device_path, "总配置.json")
    with open(total_config_path, "w", encoding="utf-8") as f:
        json.dump(program.config, f, ensure_ascii=False)
    version_path = os.path.join(device_path, "版本.json")
    with open(version_path, "w", encoding="utf-8") as f:
        json.dump({"current_version": 0, "published_version": 0, "publish_status": "unpublished"}, f, ensure_ascii=False)
    await db.commit()
    await db.refresh(program)
    return program


async def get_program_detail(db: AsyncSession, program_id: uuid.UUID):
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
    exhibit_name = exhibit.name if exhibit else ""
    scene_name = scene.name if scene else ""
    device_name = device.name if device else ""
    return {
        "id": program.id, "device_id": program.device_id, "scene_id": program.scene_id,
        "exhibit_id": program.exhibit_id, "name": program.name, "config": program.config,
        "current_version": program.current_version, "published_version": program.published_version,
        "publish_status": program.publish_status,
        "exhibit_name": exhibit_name, "scene_name": scene_name, "device_name": device_name,
        "exhibit_path": f"{exhibit_name} > {scene_name} > {device_name}",
        "created_at": program.created_at, "updated_at": program.updated_at
    }


async def copy_program(db: AsyncSession, program_id: uuid.UUID, target_device_ids: list[uuid.UUID], creator_id: uuid.UUID | None) -> list[Program]:
    result = await db.execute(select(Program).where(Program.id == program_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="节目不存在")
    new_programs = []
    for device_id in target_device_ids:
        dev_result = await db.execute(select(Device).where(Device.id == device_id))
        device = dev_result.scalar_one_or_none()
        if not device:
            continue
        existing = await db.execute(
            select(Program).where(Program.device_id == device_id, Program.scene_id == source.scene_id)
        )
        if existing.scalar_one_or_none():
            continue
        new_prog = Program(
            device_id=device_id, scene_id=source.scene_id,
            exhibit_id=device.exhibit_id, name=f"{source.name} (副本)",
            config=source.config, creator_id=creator_id
        )
        db.add(new_prog)
        await db.flush()
        new_prog.storage_path = os.path.join(settings.STORAGE_ROOT, "programs", str(new_prog.id))
        os.makedirs(new_prog.storage_path, exist_ok=True)
        config_path = os.path.join(new_prog.storage_path, "config.json")
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(new_prog.config, f, ensure_ascii=False)
        new_programs.append(new_prog)
    await db.commit()
    for p in new_programs:
        await db.refresh(p)
    return new_programs


async def delete_program(db: AsyncSession, program_id: uuid.UUID):
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="节目不存在")
    if program.storage_path and os.path.exists(program.storage_path):
        shutil.rmtree(program.storage_path, ignore_errors=True)
    await db.delete(program)
    await db.commit()


async def update_config(db: AsyncSession, program_id: uuid.UUID, config: dict) -> Program:
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(status_code=404, detail="节目不存在")
    program.config = config
    program.current_version += 1
    program.publish_status = "modified" if program.published_version > 0 else "unpublished"

    ex_result = await db.execute(select(Exhibit).where(Exhibit.id == program.exhibit_id))
    exhibit = ex_result.scalar_one_or_none()
    sc_result = await db.execute(select(Scene).where(Scene.id == program.scene_id))
    scene = sc_result.scalar_one_or_none()
    dev_result = await db.execute(select(Device).where(Device.id == program.device_id))
    device = dev_result.scalar_one_or_none()
    exhibit_name = exhibit.name if exhibit else "未分类展项"
    scene_name = scene.name if scene else "未分类场景"
    device_name = device.name if device else str(program.device_id)

    device_path = os.path.join(settings.STORAGE_ROOT, make_device_dir(exhibit_name, scene_name, device_name))
    os.makedirs(device_path, exist_ok=True)
    program.storage_path = device_path

    total_path = os.path.join(device_path, "总配置.json")
    with open(total_path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False)

    version_info = {
        "current_version": program.current_version,
        "published_version": program.published_version,
        "publish_status": program.publish_status,
    }
    version_path = os.path.join(device_path, "版本.json")
    with open(version_path, "w", encoding="utf-8") as f:
        json.dump(version_info, f, ensure_ascii=False)

    pages = config.get("pages", [])
    for page in pages:
        page_name = page.get("name") or page.get("id", f"page_{pages.index(page)}")
        page_dir = os.path.join(settings.STORAGE_ROOT, make_page_dir(exhibit_name, scene_name, device_name, page_name))
        os.makedirs(page_dir, exist_ok=True)
        page_config_path = os.path.join(page_dir, "config.json")
        with open(page_config_path, "w", encoding="utf-8") as f:
            json.dump(page, f, ensure_ascii=False)

    loop = asyncio.get_running_loop()
    minio_key = f"{make_minio_prefix(exhibit_name, scene_name, device_name)}/总配置.json"
    await loop.run_in_executor(None, upload_json, minio_key, config)
    await db.commit()
    await db.refresh(program)
    return program
