import hashlib
import aiofiles


async def compute_sha256(file_path: str) -> str:
    sha256 = hashlib.sha256()
    async with aiofiles.open(file_path, "rb") as f:
        while chunk := await f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()


def compute_sha256_from_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
