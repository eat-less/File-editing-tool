from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.user import UserCreate, UserLogin
from app.services.auth_service import (
    authenticate_user, create_user, get_current_user, require_admin,
    get_user_list, soft_delete_user, create_access_token
)
from app.services.log_service import write_log
from app.utils.response import success_response, error_response

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login")
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.username, data.password)
    if not user:
        await write_log(db, "info", "auth", f"用户 {data.username} 登录失败: 密码错误")
        return error_response("用户名或密码错误", code=401)
    token = create_access_token(user)
    await write_log(db, "info", "auth", f"用户 {user.username} 登录成功", operator_id=user.id)
    return success_response({
        "token": token,
        "user": {"id": str(user.id), "username": user.username, "role": user.role}
    })


@router.post("/logout")
async def logout(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    await write_log(db, "info", "auth", f"用户 {current_user.username} 登出", operator_id=current_user.id)
    return success_response(message="已登出")


@router.get("/check")
async def check_auth(current_user=Depends(get_current_user)):
    return success_response({"id": str(current_user.id), "username": current_user.username, "role": current_user.role})


@router.post("/users")
async def new_user(data: UserCreate, db: AsyncSession = Depends(get_db), admin=Depends(require_admin)):
    user = await create_user(db, data.username, data.password, role=data.role, created_by=admin.id)
    await write_log(db, "success", "auth", f"管理员 {admin.username} 创建用户 {user.username}", operator_id=admin.id)
    return success_response({"id": str(user.id), "username": user.username, "role": user.role})


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), admin=Depends(require_admin)):
    users = await get_user_list(db, admin)
    return success_response([{"id": str(u.id), "username": u.username, "role": u.role, "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None, "last_login": u.last_login.isoformat() if u.last_login else None} for u in users])


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, db: AsyncSession = Depends(get_db), admin=Depends(require_admin)):
    await soft_delete_user(db, user_id, admin)
    await write_log(db, "success", "auth", f"管理员 {admin.username} 删除用户 {user_id}", operator_id=admin.id)
    return success_response(message="用户已删除")
