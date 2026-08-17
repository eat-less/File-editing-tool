import json
from typing import Dict, List, Set
from fastapi import WebSocket


class WSManager:
    def __init__(self):
        self._device_connections: Dict[str, WebSocket] = {}
        self._admin_connections: Set[WebSocket] = set()
        self._control_connections: Set[WebSocket] = set()

    async def connect_device(self, device_code: str, websocket: WebSocket):
        await websocket.accept()
        self._device_connections[device_code] = websocket

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self._admin_connections.add(websocket)

    async def connect_control(self, websocket: WebSocket):
        await websocket.accept()
        self._control_connections.add(websocket)

    def disconnect_device(self, device_code: str):
        self._device_connections.pop(device_code, None)

    def disconnect_admin(self, websocket: WebSocket):
        self._admin_connections.discard(websocket)

    def disconnect_control(self, websocket: WebSocket):
        self._control_connections.discard(websocket)

    async def broadcast_to_device(self, device_code: str, message: dict):
        ws = self._device_connections.get(device_code)
        if ws:
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False))
            except Exception:
                self.disconnect_device(device_code)

    async def broadcast_to_devices(self, device_codes: List[str], message: dict) -> int:
        delivered = 0
        for code in device_codes:
            ws = self._device_connections.get(code)
            if ws:
                try:
                    await ws.send_text(json.dumps(message, ensure_ascii=False))
                    delivered += 1
                except Exception:
                    self.disconnect_device(code)
        return delivered

    async def broadcast_to_all_devices(self, message: dict) -> int:
        return await self.broadcast_to_devices(list(self._device_connections.keys()), message)

    async def broadcast_to_admins(self, message: dict):
        dead = set()
        for ws in self._admin_connections:
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._admin_connections.discard(ws)

    async def broadcast_to_controls(self, message: dict):
        dead = set()
        for ws in self._control_connections:
            try:
                await ws.send_text(json.dumps(message, ensure_ascii=False))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._control_connections.discard(ws)

    def get_device_status(self, device_code: str) -> str:
        return "online" if device_code in self._device_connections else "offline"

    def get_online_device_codes(self) -> List[str]:
        return list(self._device_connections.keys())


ws_manager = WSManager()
