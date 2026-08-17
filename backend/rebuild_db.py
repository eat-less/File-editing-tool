import asyncio
from app.database import engine, Base

async def rebuild():
    from app.models.user import User
    from app.models.exhibit import Exhibit, Scene, Device
    from app.models.project import Program, Asset
    from app.models.distribution import VersionSnapshot, DistributionLog
    from app.models.system_log import SystemLog
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        print("Tables dropped")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables recreated with new schema")
    print("Done")

if __name__ == "__main__":
    asyncio.run(rebuild())
