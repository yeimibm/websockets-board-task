import re

from app.models.room import RoomState

ROOM_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")


class RoomManager:
    """Owns all authoritative room states for this process."""

    def __init__(self) -> None:
        self.rooms: dict[str, RoomState] = {}

    @staticmethod
    def is_valid_room_id(room_id: str) -> bool:
        return bool(ROOM_ID_PATTERN.fullmatch(room_id))

    def get_or_create(self, room_id: str) -> RoomState:
        if not self.is_valid_room_id(room_id):
            raise ValueError("INVALID_ROOM_ID")
        return self.rooms.setdefault(room_id, RoomState(room_id=room_id))

    def get(self, room_id: str) -> RoomState | None:
        return self.rooms.get(room_id)


room_manager = RoomManager()

