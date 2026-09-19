import asyncio
from dataclasses import dataclass, field

from .block import Block
from .connection import Connection
from .participant import Participant


@dataclass(slots=True)
class RoomState:
    room_id: str
    version: int = 0
    participants: dict[str, Participant] = field(default_factory=dict)
    blocks: dict[str, Block] = field(default_factory=dict)
    connections: dict[str, Connection] = field(default_factory=dict)
    processed_operations: dict[str, dict] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)

    def snapshot(self) -> dict:
        return {
            "participants": [
                participant.model_dump(mode="json", by_alias=True)
                for participant in self.participants.values()
            ],
            "blocks": [block.model_dump(mode="json", by_alias=True) for block in self.blocks.values()],
            "connections": [
                connection.model_dump(mode="json", by_alias=True)
                for connection in self.connections.values()
            ],
        }

