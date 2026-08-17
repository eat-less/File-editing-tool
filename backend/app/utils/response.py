from typing import Any, Optional


def success_response(data: Any = None, message: str = "success", code: int = 200) -> dict:
    return {"code": code, "message": message, "data": data}


def error_response(message: str, code: int = 400, data: Any = None, solution: Optional[str] = None) -> dict:
    result = {"code": code, "message": message, "data": data}
    if solution:
        result["solution"] = solution
    return result
