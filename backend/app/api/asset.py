import uuid
from fastapi import APIRouter, Depends, UploadFile, File, Form, Request
from fastapi.responses import StreamingResponse, FileResponse
import io
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.auth_service import get_current_user
from app.services import asset_service
from app.services.log_service import write_log
from app.utils.response import success_response, error_response

router = APIRouter(tags=["素材管理"])


@router.post("/assets/upload")
async def upload_single(file: UploadFile = File(...),
                        exhibit_id: str | None = Form(None),
                        scene_id: str | None = Form(None),
                        db: AsyncSession = Depends(get_db),
                        current_user=Depends(get_current_user)):
    result = await asset_service.upload_asset(db, file, current_user.id, exhibit_id, scene_id)
    return success_response(result)


@router.post("/assets/upload/batch")
async def upload_batch(files: list[UploadFile] = File(...), remove_date_prefix: bool = Form(True),
                       request: Request = None, db: AsyncSession = Depends(get_db),
                       current_user=Depends(get_current_user)):
    results = await asset_service.upload_batch_files(db, files, remove_date_prefix, current_user.id)
    await write_log(db, "success", "asset", f"用户 {current_user.username} 批量上传 {len(files)} 个文件",
                    operator_id=current_user.id)
    return success_response(results)


@router.post("/assets/upload/sequence")
async def upload_sequence_endpoint(files: list[UploadFile] = File(...),
                                   exhibit_id: str | None = Form(None),
                                   scene_id: str | None = Form(None),
                                   folder_name: str = Form("sequence"),
                                   db: AsyncSession = Depends(get_db),
                                    current_user=Depends(get_current_user)):
    try:
        result = await asset_service.upload_sequence(db, files, current_user.id, exhibit_id, scene_id, folder_name)
        await write_log(db, "success", "asset", f"用户 {current_user.username} 上传序列帧 {len(files)} 帧",
                        operator_id=current_user.id)
        return success_response(result)
    except Exception as e:
        await write_log(db, "operation_failed", "asset", f"序列帧上传失败: {str(e)}",
                        operator_id=current_user.id)
        return error_response(f"序列帧上传失败: {str(e)}")


@router.get("/assets")
async def list_assets(file_type: str | None = None, exhibit_id: str | None = None,
                      scene_id: str | None = None,
                      keyword: str | None = None, page: int = 1, page_size: int = 20,
                      db: AsyncSession = Depends(get_db)):
    result = await asset_service.get_assets_list(db, file_type, exhibit_id, scene_id, keyword, page, page_size)
    return success_response(result)


@router.get("/assets/{hash_key}")
async def get_asset_info(hash_key: str, db: AsyncSession = Depends(get_db)):
    asset = await asset_service.get_asset_by_hash(db, hash_key)
    if not asset:
        return error_response("素材不存在", code=404)
    return success_response({
        "id": str(asset.id), "hash_key": asset.hash_key, "original_name": asset.original_name,
        "file_size": asset.file_size, "mime_type": asset.mime_type, "file_type": asset.file_type,
        "reference_count": asset.reference_count, "url": asset_service.get_minio_url(hash_key)
    })


@router.get("/assets/{hash_key}/thumb")
async def asset_thumb(hash_key: str, db: AsyncSession = Depends(get_db)):
    asset = await asset_service.get_asset_by_hash(db, hash_key)
    if not asset:
        return error_response("素材不存在", code=404)
    if asset.local_path and __import__("os").path.exists(asset.local_path):
        return FileResponse(asset.local_path, media_type=asset.mime_type)
    data = asset_service.get_minio_data(hash_key, asset.file_type, asset.original_name)
    if data:
        return StreamingResponse(io.BytesIO(data), media_type=asset.mime_type or "image/png")
    return error_response("文件不可用", code=404)


@router.get("/assets/{hash_key}/file")
async def asset_file(hash_key: str, db: AsyncSession = Depends(get_db)):
    asset = await asset_service.get_asset_by_hash(db, hash_key)
    if not asset:
        return error_response("素材不存在", code=404)
    if asset.local_path and __import__("os").path.exists(asset.local_path):
        return FileResponse(asset.local_path, media_type=asset.mime_type)
    data = asset_service.get_minio_data(hash_key, asset.file_type, asset.original_name)
    if data:
        return StreamingResponse(io.BytesIO(data), media_type=asset.mime_type or "application/octet-stream")
    return error_response("文件不可用", code=404)


@router.delete("/assets/{hash_key}")
async def delete_asset(hash_key: str, request: Request, db: AsyncSession = Depends(get_db),
                       current_user=Depends(get_current_user)):
    try:
        count = await asset_service.delete_asset_by_hash(db, hash_key)
        await write_log(db, "info", "asset", f"用户 {current_user.username} 删除素材 {hash_key}",
                        operator_id=current_user.id)
        return success_response(message="素材已删除")
    except Exception as e:
        return error_response(str(e), code=400)


@router.post("/assets/cleanup-unreferenced")
async def cleanup_assets(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    count = await asset_service.cleanup_unreferenced(db)
    await write_log(db, "info", "asset", f"用户 {current_user.username} 清理了 {count} 个未引用素材",
                    operator_id=current_user.id)
    return success_response({"cleaned": count})
