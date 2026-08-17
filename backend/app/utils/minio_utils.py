import json
import logging
from typing import Optional

import boto3

from app.config import settings

logger = logging.getLogger(__name__)

_client = None


def get_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"http://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name="us-east-1",
            config=boto3.session.Config(signature_version="s3v4", connect_timeout=5, read_timeout=10),
        )
    return _client


def ensure_bucket():
    try:
        client = get_client()
        client.head_bucket(Bucket=settings.MINIO_BUCKET)
    except Exception:
        client.create_bucket(Bucket=settings.MINIO_BUCKET)
        logger.info(f"MinIO bucket '{settings.MINIO_BUCKET}' created")


# ─── Asset key builders ─────────────────────────────────────────────

def build_asset_key(file_type: str, hash_key: str, original_name: str) -> str:
    prefix_map = {"image": "images", "video": "videos", "sequence_folder": "sequences", "spritesheet": "spritesheets"}
    prefix = prefix_map.get(file_type, "images")
    safe_name = original_name.replace("\\", "/").split("/")[-1]
    return f"assets/{prefix}/{hash_key[:2]}/{hash_key[2:]}_{safe_name}"


def build_asset_prefix_by_hash(hash_key: str) -> str:
    return f"assets/images/{hash_key[:2]}/{hash_key[2:]}"


# ─── Config key builders ────────────────────────────────────────────

def build_config_key(program_id: str) -> str:
    pid = str(program_id).replace("-", "")
    return f"configs/programs/{pid}/config.json"


def build_config_version_key(program_id: str, version: int) -> str:
    pid = str(program_id).replace("-", "")
    return f"configs/programs/{pid}/versions/v{version}"


# ─── Upload / Download (sync, wrapped by run_in_executor) ──────────

def upload_bytes(object_key: str, data: bytes, mime_type: str):
    try:
        client = get_client()
        client.put_object(Bucket=settings.MINIO_BUCKET, Key=object_key, Body=data, ContentType=mime_type)
        return True
    except Exception as e:
        logger.warning(f"MinIO upload failed [{object_key}]: {e}")
        return False


def upload_json(object_key: str, data: dict):
    body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    return upload_bytes(object_key, body, "application/json")


def get_presigned_url(object_key: str, expires: int = 3600) -> str:
    try:
        client = get_client()
        return client.generate_presigned_url(
            "get_object", Params={"Bucket": settings.MINIO_BUCKET, "Key": object_key}, ExpiresIn=expires
        )
    except Exception as e:
        logger.warning(f"MinIO presigned URL failed [{object_key}]: {e}")
        return ""


def get_object_data(object_key: str) -> bytes | None:
    try:
        client = get_client()
        resp = client.get_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
        return resp["Body"].read()
    except Exception as e:
        logger.warning(f"MinIO get_object failed [{object_key}]: {e}")
        return None


def head_object(object_key: str) -> bool:
    try:
        client = get_client()
        client.head_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
        return True
    except Exception:
        return False


def list_objects(prefix: str, max_keys: int = 100):
    try:
        client = get_client()
        return client.list_objects_v2(Bucket=settings.MINIO_BUCKET, Prefix=prefix, MaxKeys=max_keys)
    except Exception as e:
        logger.warning(f"MinIO list failed [{prefix}]: {e}")
        return {"Contents": []}


def delete_object(object_key: str):
    try:
        client = get_client()
        client.delete_object(Bucket=settings.MINIO_BUCKET, Key=object_key)
    except Exception as e:
        logger.warning(f"MinIO delete failed [{object_key}]: {e}")


def delete_objects_by_prefix(prefix: str):
    try:
        client = get_client()
        result = client.list_objects_v2(Bucket=settings.MINIO_BUCKET, Prefix=prefix)
        for obj in result.get("Contents", []):
            client.delete_object(Bucket=settings.MINIO_BUCKET, Key=obj["Key"])
    except Exception as e:
        logger.warning(f"MinIO bulk delete failed [{prefix}]: {e}")


def reset_client():
    global _client
    _client = None
