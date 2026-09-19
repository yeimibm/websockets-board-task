from dataclasses import dataclass

from fastapi import WebSocket


@dataclass(frozen=True, slots=True)
class ClientSession:
    room_id: str
    user_id: str
    websocket: WebSocket


class ConnectionManager:
    """Tracks live sockets separately from persistent room state."""

    def __init__(self) -> None:
        self._connections: dict[str, dict[WebSocket, ClientSession]] = {}

    async def accept(self, websocket: WebSocket) -> None:
        await websocket.accept()

    def register(self, websocket: WebSocket, room_id: str, user_id: str) -> ClientSession:
        session = ClientSession(room_id=room_id, user_id=user_id, websocket=websocket)
        self._connections.setdefault(room_id, {})[websocket] = session
        return session

    def unregister(self, websocket: WebSocket) -> ClientSession | None:
        for room_id, room_connections in tuple(self._connections.items()):
            session = room_connections.pop(websocket, None)
            if session is not None:
                if not room_connections:
                    self._connections.pop(room_id, None)
                return session
        return None

    async def send(self, websocket: WebSocket, event: dict) -> bool:
        try:
            await websocket.send_json(event)
            return True
        except (RuntimeError, OSError):
            self.unregister(websocket)
            return False

    async def broadcast(
        self,
        room_id: str,
        event: dict,
        *,
        exclude: WebSocket | None = None,
    ) -> list[ClientSession]:
        dead: list[ClientSession] = []
        sessions = tuple(self._connections.get(room_id, {}).values())
        for session in sessions:
            if session.websocket is exclude:
                continue
            if not await self.send(session.websocket, event):
                dead.append(session)
        return dead

    def count(self, room_id: str) -> int:
        return len(self._connections.get(room_id, {}))


connection_manager = ConnectionManager()

