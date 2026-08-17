import re
from typing import Optional

_TYPE_MAP = {
    "image": "图片",
    "video": "视频",
    "sequence_folder": "序列帧",
    "spritesheet": "图片",
}


def _safe(name: str) -> str:
    safe = re.sub(r'[\x00-\x1f<>:"/\\|?*]', '_', name).strip().rstrip('.')
    return safe or "unnamed"


def make_exhibit_dir(exhibit_name: str) -> str:
    return _safe(exhibit_name)


def make_scene_dir(exhibit_name: str, scene_name: str) -> str:
    return f"{make_exhibit_dir(exhibit_name)}/{_safe(scene_name)}"


def make_asset_dir(exhibit_name: str, scene_name: str, file_type: Optional[str] = None) -> str:
    base = f"{make_scene_dir(exhibit_name, scene_name)}/素材"
    if file_type:
        base += f"/{_TYPE_MAP.get(file_type, '图片')}"
    return base


def make_asset_path(exhibit_name: str, scene_name: str, file_type: str, filename: str) -> str:
    return f"{make_asset_dir(exhibit_name, scene_name, file_type)}/{filename}"


def make_device_dir(exhibit_name: str, scene_name: str, device_name: str) -> str:
    return f"{make_scene_dir(exhibit_name, scene_name)}/{_safe(device_name)}"


def make_workspace_dir(exhibit_name: str, scene_name: str, device_name: str) -> str:
    return f"{make_device_dir(exhibit_name, scene_name, device_name)}/当前工作区"


def make_page_dir(exhibit_name: str, scene_name: str, device_name: str, page_name: str) -> str:
    return f"{make_workspace_dir(exhibit_name, scene_name, device_name)}/{_safe(page_name)}"


def make_publish_dir(exhibit_name: str, scene_name: str, device_name: str, version: int) -> str:
    return f"{make_device_dir(exhibit_name, scene_name, device_name)}/导出历史/V{version}"


def make_minio_prefix(exhibit_name: str, scene_name: str, device_name: str) -> str:
    return f"{_safe(exhibit_name)}/{_safe(scene_name)}/{_safe(device_name)}"


def make_minio_asset_prefix(exhibit_name: str, scene_name: str) -> str:
    return f"{_safe(exhibit_name)}/{_safe(scene_name)}/素材"
