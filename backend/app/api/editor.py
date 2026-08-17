import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services import project_service as ps
from app.utils.response import success_response

router = APIRouter(prefix="/editor", tags=["编辑器"])


@router.get("/programs/{program_id}/load")
async def load_program(program_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    program = await ps.get_program_detail(db, program_id)
    return success_response(program)
