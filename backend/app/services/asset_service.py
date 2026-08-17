import os
import re
import uuid
import json
import asyncio
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, UploadFile
from app.config import settings
from app.models.project import Asset
from app.models.exhibit import Exhibit, Scene
from app.utils.hash_utils import compute_sha256_from_bytes
from app.utils.minio_utils import (
    build_asset_key,
    build_asset_prefix_by_hash,
    delete_object,
    get_presigned_url,
    list_objects,
    upload_bytes,
)
from app.utils.minio_utils import get_client as get_minio_client  # compatibility


def _extract_file_type(filename: str, ext: str) -> str:
    if ext in (".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"):
        return "image"
    elif ext in (".mp4", ".mov", ".avi", ".webm", ".mkv"):
        return "video"
    else:
        return "other"


async def _upload_asset_to_minio(hash_key: str, data: bytes, mime_type: str, file_type: str, original_name: str):
    new_key = build_asset_key(file_type, hash_key, original_name)
    loop = asyncio.get_running_loop()
    ok = await loop.run_in_executor(None, upload_bytes, new_key, data, mime_type)
    if not ok:
        ok = await loop.run_in_executor(None, upload_bytes, f"assets/{hash_key}", data, mime_type)
    return ok


def _get_asset_minio_url(hash_key: str, file_type: str = "image", original_name: str = "") -> str:
    new_key = build_asset_key(file_type, hash_key, original_name or "file")
    url = get_presigned_url(new_key)
    if url:
        return url
    url = get_presigned_url(f"assets/{hash_key}")
    if url:
        return url
    for prefix in ["images", "videos", "sequences"]:
        result = list_objects(f"assets/{prefix}/{hash_key[:2]}/{hash_key[2:]}")
        for obj in result.get("Contents", []):
            return get_presigned_url(obj["Key"])
    return ""


async def upload_asset(db: AsyncSession, file: UploadFile, uploader_id: uuid.UUID | None = None,
                       exhibit_id: uuid.UUID | None = None, scene_id: uuid.UUID | None = None) -> dict:
    content = await file.read()
    hash_key = compute_sha256_from_bytes(content)
    mime_type = file.content_type or "application/octet-stream"
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    file_type = _extract_file_type(file.filename or "", ext)

    result = await db.execute(select(Asset).where(Asset.hash_key == hash_key))
    existing = result.scalar_one_or_none()
    if existing:
        return {"hash_key": existing.hash_key, "original_name": existing.original_name,
                "file_type": existing.file_type, "is_duplicate": True}

    exhibit_name = "未分类展项"
    scene_name = "未分类场景"
    if exhibit_id:
        er = await db.execute(select(Exhibit).where(Exhibit.id == exhibit_id))
        e = er.scalar_one_or_none()
        if e:
            exhibit_name = e.name
    if scene_id:
        sr = await db.execute(select(Scene).where(Scene.id == scene_id))
        s = sr.scalar_one_or_none()
        if s:
            scene_name = s.name

    _TYPE_MAP = {"image": "图片", "video": "视频", "sequence_folder": "序列帧", "other": "其他"}
    type_dir = _TYPE_MAP.get(file_type, "其他")
    local_dir = os.path.join(settings.STORAGE_ROOT, exhibit_name, scene_name, "素材", type_dir)
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, os.path.basename(file.filename or hash_key))
    with open(local_path, "wb") as f:
        f.write(content)

    await _upload_asset_to_minio(hash_key, content, mime_type, file_type, file.filename or "unknown")

    asset = Asset(
        hash_key=hash_key, original_name=file.filename or "unknown",
        file_size=len(content), mime_type=mime_type, file_type=file_type,
        local_path=local_path, uploader_id=uploader_id,
        exhibit_id=exhibit_id, scene_id=scene_id,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return {"hash_key": asset.hash_key, "original_name": asset.original_name,
            "file_type": asset.file_type, "is_duplicate": False,
            "url": _get_asset_minio_url(hash_key, file_type, file.filename or "")}


async def upload_batch_files(db: AsyncSession, files: list[UploadFile], remove_date_prefix: bool, uploader_id: uuid.UUID | None = None) -> list[dict]:
    results = []
    for file in files:
        content = await file.read()
        hash_key = compute_sha256_from_bytes(content)
        mime_type = file.content_type or "application/octet-stream"
        ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
        file_type = _extract_file_type(file.filename or "", ext)
        caption = extract_caption(file.filename, remove_date_prefix)

        result = await db.execute(select(Asset).where(Asset.hash_key == hash_key))
        existing = result.scalar_one_or_none()
        if existing:
            results.append({"hash_key": existing.hash_key, "original_name": existing.original_name,
                           "caption": caption, "file_type": existing.file_type, "is_duplicate": True})
            continue

        save_dir = os.path.join(settings.MINIO_DATA_DIR, "assets")
        os.makedirs(save_dir, exist_ok=True)
        local_path = os.path.join(save_dir, hash_key)
        with open(local_path, "wb") as f:
            f.write(content)

        await _upload_asset_to_minio(hash_key, content, mime_type, file_type, file.filename or "unknown")

        asset = Asset(
            hash_key=hash_key, original_name=file.filename or "unknown",
            file_size=len(content), mime_type=mime_type, file_type=file_type,
            local_path=local_path, uploader_id=uploader_id
        )
        db.add(asset)
        await db.commit()
        await db.refresh(asset)
        results.append({"hash_key": asset.hash_key, "original_name": asset.original_name,
                       "caption": caption, "file_type": asset.file_type, "is_duplicate": False,
                       "url": _get_asset_minio_url(hash_key, file_type, file.filename or "")})
    return results


async def upload_sequence(db: AsyncSession, files: list[UploadFile], uploader_id: uuid.UUID | None = None,
                         exhibit_id: uuid.UUID | None = None, scene_id: uuid.UUID | None = None,
                         folder_name: str = "sequence") -> dict:
    def natural_sort_key(fname: str) -> list:
        name = os.path.splitext(fname)[0]
        return [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', name)]

    sorted_files = sorted(files, key=lambda f: natural_sort_key(f.filename or ""))
    frames = []
    first_frame_hash = None

    exhibit_name = "未分类展项"
    scene_name = "未分类场景"
    if exhibit_id:
        er = await db.execute(select(Exhibit).where(Exhibit.id == exhibit_id))
        e = er.scalar_one_or_none()
        if e:
            exhibit_name = e.name
    if scene_id:
        sr = await db.execute(select(Scene).where(Scene.id == scene_id))
        s = sr.scalar_one_or_none()
        if s:
            scene_name = s.name

    storage_seq_dir = os.path.join(settings.STORAGE_ROOT, exhibit_name, scene_name, "素材", "序列帧")
    os.makedirs(storage_seq_dir, exist_ok=True)

    for i, file in enumerate(sorted_files):
        content = await file.read()
        hash_key = compute_sha256_from_bytes(content)
        mime_type = file.content_type or "application/octet-stream"
        filename = os.path.basename(file.filename or f"frame_{i:04d}.png")

        result = await db.execute(select(Asset).where(Asset.hash_key == hash_key))
        existing = result.scalar_one_or_none()
        if not existing:
            minio_save_dir = os.path.join(settings.MINIO_DATA_DIR, "assets")
            os.makedirs(minio_save_dir, exist_ok=True)
            minio_local_path = os.path.join(minio_save_dir, hash_key)
            with open(minio_local_path, "wb") as f:
                f.write(content)

            storage_local_path = os.path.join(storage_seq_dir, filename)
            with open(storage_local_path, "wb") as f:
                f.write(content)

            await _upload_asset_to_minio(hash_key, content, mime_type, "sequence_folder", filename)
            asset = Asset(
                hash_key=hash_key, original_name=filename,
                file_size=len(content), mime_type=mime_type, file_type="image",
                local_path=storage_local_path, uploader_id=uploader_id,
                exhibit_id=exhibit_id, scene_id=scene_id,
            )
            db.add(asset)
            await db.commit()
            await db.refresh(asset)
        if i == 0:
            first_frame_hash = hash_key
        frames.append({"src": hash_key, "index": i, "original_name": filename})

    seq_folder_hash = f"seq_{uuid.uuid4().hex[:12]}"
    seq_meta_path = os.path.join(settings.MINIO_DATA_DIR, "assets", f"{seq_folder_hash}.json")
    storage_meta_path = os.path.join(storage_seq_dir, f"{seq_folder_hash}.json")
    os.makedirs(os.path.dirname(seq_meta_path), exist_ok=True)
    seq_meta = {
        "frames": frames,
        "frameCount": len(frames),
        "folderThumbnail": first_frame_hash,
        "folderName": folder_name,
    }
    with open(seq_meta_path, "w", encoding="utf-8") as f:
        json.dump(seq_meta, f)
    with open(storage_meta_path, "w", encoding="utf-8") as f:
        json.dump(seq_meta, f)

    existing_seq = await db.execute(select(Asset).where(Asset.hash_key == seq_folder_hash))
    if not existing_seq.scalar_one_or_none():
        seq_asset = Asset(
            hash_key=seq_folder_hash,
            original_name=folder_name,
            file_size=os.path.getsize(seq_meta_path),
            mime_type="application/json",
            file_type="sequence_folder",
            local_path=storage_meta_path,
            uploader_id=uploader_id,
            exhibit_id=exhibit_id,
            scene_id=scene_id,
        )
        db.add(seq_asset)
        await db.commit()

    return {"folderId": seq_folder_hash, "folderName": folder_name, "frameCount": len(frames),
            "frames": frames, "folderThumbnail": first_frame_hash}


def get_minio_url(hash_key: str, file_type: str = "image", original_name: str = "") -> str:
    return _get_asset_minio_url(hash_key, file_type, original_name)


def get_minio_data(hash_key: str, file_type: str = "image", original_name: str = "") -> bytes | None:
    from app.utils.minio_utils import get_object_data
    new_key = build_asset_key(file_type, hash_key, original_name or "file")
    data = get_object_data(new_key)
    if data:
        return data
    data = get_object_data(f"assets/{hash_key}")
    if data:
        return data
    for prefix in ["images", "videos"]:
        result = list_objects(f"assets/{prefix}/{hash_key[:2]}/{hash_key[2:]}")
        for obj in result.get("Contents", []):
            data = get_object_data(obj["Key"])
            if data:
                return data
    return None


def upload_to_minio(key: str, data: bytes, mime_type: str):
    return upload_bytes(key, data, mime_type)


def extract_caption(filename: str | None, remove_date_prefix: bool) -> str:
    import re
    if not filename:
        return ""
    name = os.path.splitext(filename)[0]
    if remove_date_prefix:
        name = re.sub(r'^\d{8}_', '', name)
        name = re.sub(r'^\d{4}-\d{2}-\d{2}_', '', name)
        name = re.sub(r'^\d{14}_', '', name)
        name = re.sub(r'^(IMG|DSC)_\d+_', '', name, flags=re.IGNORECASE)
        name = re.sub(r'_\d{8}$', '', name)
        name = re.sub(r'_\d{14}$', '', name)
    name = name.replace('_', ' ').replace('-', ' ').strip()
    return name


async def get_assets_list(db: AsyncSession, file_type: str | None = None, exhibit_id: str | None = None,
                          scene_id: str | None = None,
                          keyword: str | None = None, page: int = 1, page_size: int = 20) -> dict:
    ex_id = None
    sc_id = None
    if exhibit_id:
        try:
            ex_id = uuid.UUID(exhibit_id)
        except ValueError:
            pass
    if scene_id:
        try:
            sc_id = uuid.UUID(scene_id)
        except ValueError:
            pass

    q = select(Asset)
    if file_type:
        q = q.where(Asset.file_type == file_type)
    if ex_id is not None:
        q = q.where(Asset.exhibit_id == ex_id)
    if sc_id is not None:
        q = q.where(Asset.scene_id == sc_id)
    if keyword:
        q = q.where(Asset.original_name.ilike(f"%{keyword}%"))
    q = q.order_by(Asset.created_at.desc())

    count_q = select(func.count(Asset.id))
    if file_type:
        count_q = count_q.where(Asset.file_type == file_type)
    if ex_id is not None:
        count_q = count_q.where(Asset.exhibit_id == ex_id)
    if sc_id is not None:
        count_q = count_q.where(Asset.scene_id == sc_id)
    if keyword:
        count_q = count_q.where(Asset.original_name.ilike(f"%{keyword}%"))
    total = (await db.execute(count_q)).scalar() or 0

    q = q.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(q)
    assets = list(result.scalars().all())

    seq_frame_hashes: set = set()
    if not file_type or file_type == "image":
        seq_q = select(Asset).where(Asset.file_type == "sequence_folder")
        if ex_id is not None:
            seq_q = seq_q.where(Asset.exhibit_id == ex_id)
        if sc_id is not None:
            seq_q = seq_q.where(Asset.scene_id == sc_id)
        seq_result = await db.execute(seq_q)
        for s in seq_result.scalars():
            if s.local_path and len(s.local_path) < 500 and os.path.exists(s.local_path):
                try:
                    with open(s.local_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    for frame in meta.get("frames", []):
                        if frame.get("src"):
                            seq_frame_hashes.add(frame["src"])
                except (json.JSONDecodeError, OSError):
                    pass

    ex_names = {}
    sc_names = {}
    for a in assets:
        if a.exhibit_id and a.exhibit_id not in ex_names:
            ex_names[a.exhibit_id] = a.exhibit_id
        if a.scene_id and a.scene_id not in sc_names:
            sc_names[a.scene_id] = a.scene_id

    if ex_names:
        er = await db.execute(select(Exhibit).where(Exhibit.id.in_(ex_names.keys())))
        for e in er.scalars():
            ex_names[e.id] = e.name
    if sc_names:
        sr = await db.execute(select(Scene).where(Scene.id.in_(sc_names.keys())))
        for s in sr.scalars():
            sc_names[s.id] = s.name

    items = []
    for a in assets:
        if seq_frame_hashes and a.file_type == "image" and a.hash_key in seq_frame_hashes:
            continue
        item = {
            "id": a.id, "hash_key": a.hash_key, "original_name": a.original_name,
            "file_size": a.file_size, "mime_type": a.mime_type, "file_type": a.file_type,
            "exhibit_id": str(a.exhibit_id) if a.exhibit_id else None,
            "scene_id": str(a.scene_id) if a.scene_id else None,
            "exhibit_name": ex_names.get(a.exhibit_id, ""),
            "scene_name": sc_names.get(a.scene_id, ""),
            "reference_count": a.reference_count, "created_at": a.created_at,
            "url": "" if a.file_type == "sequence_folder" else _get_asset_minio_url(a.hash_key, a.file_type, a.original_name)
        }
        if a.file_type == "sequence_folder" and a.local_path:
            try:
                if len(a.local_path) < 500 and os.path.exists(a.local_path):
                    with open(a.local_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    item["frames"] = meta.get("frames", [])
                    item["frameCount"] = meta.get("frameCount", 0)
                    item["folderThumbnail"] = meta.get("folderThumbnail", "")
            except (json.JSONDecodeError, TypeError, OSError, ValueError):
                pass
        items.append(item)
    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_asset_by_hash(db: AsyncSession, hash_key: str) -> Asset | None:
    result = await db.execute(select(Asset).where(Asset.hash_key == hash_key))
    return result.scalar_one_or_none()


async def delete_asset_by_hash(db: AsyncSession, hash_key: str) -> int:
    result = await db.execute(select(Asset).where(Asset.hash_key == hash_key))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="素材不存在")
    if asset.local_path:
        try:
            if len(asset.local_path) < 500 and os.path.exists(asset.local_path):
                os.remove(asset.local_path)
        except OSError:
            pass
        try:
            meta_file = os.path.join(settings.MINIO_DATA_DIR, "assets", f"{hash_key}.json")
            if os.path.exists(meta_file):
                os.remove(meta_file)
        except OSError:
            pass
    await db.delete(asset)
    await db.commit()
    return 0


async def cleanup_unreferenced(db: AsyncSession) -> int:
    result = await db.execute(select(Asset).where(Asset.reference_count == 0))
    assets = list(result.scalars().all())
    count = 0
    for asset in assets:
        try:
            if asset.local_path and os.path.exists(asset.local_path):
                os.remove(asset.local_path)
            for prefix in ["images", "videos", "sequences", "spritesheets"]:
                r = list_objects(f"assets/{prefix}/{asset.hash_key[:2]}/{asset.hash_key[2:]}")
                for obj in r.get("Contents", []):
                    delete_object(obj["Key"])
            delete_object(f"assets/{asset.hash_key}")
            await db.delete(asset)
            count += 1
        except Exception:
            pass
    if count > 0:
        await db.commit()
    return count


def collect_asset_hashes(config) -> set:
    hash_keys = set()

    def _find_hashes(obj):
        if isinstance(obj, dict):
            if obj.get("src"):
                hash_keys.add(obj["src"])
            if obj.get("assetHash"):
                hash_keys.add(obj["assetHash"])
            if obj.get("poster"):
                hash_keys.add(obj["poster"])
            if obj.get("frames"):
                for f in obj["frames"]:
                    if f.get("src"):
                        hash_keys.add(f["src"])
            if obj.get("srcs"):
                for s in obj["srcs"]:
                    if isinstance(s, str):
                        hash_keys.add(s)
            for v in obj.values():
                _find_hashes(v)
        elif isinstance(obj, list):
            for item in obj:
                _find_hashes(item)

    _find_hashes(config)
    return hash_keys


async def update_reference_counts(db: AsyncSession, config: dict):
    hash_keys = collect_asset_hashes(config)
    all_assets = (await db.execute(select(Asset))).scalars().all()
    for a in all_assets:
        a.reference_count = 0
    for hk in hash_keys:
        result = await db.execute(select(Asset).where(Asset.hash_key == hk))
        asset = result.scalar_one_or_none()
        if asset:
            asset.reference_count += 1
    await db.commit()
