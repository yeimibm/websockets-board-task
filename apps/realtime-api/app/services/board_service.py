import math
from datetime import UTC, datetime
from uuid import uuid4

from app.core.config import settings
from app.models.block import Block
from app.models.connection import Connection
from app.models.events import (
    BlockCreateEvent,
    BlockDeleteEvent,
    BlockMoveEvent,
    BlockUpdateEvent,
    ConnectionCreateEvent,
    ConnectionDeleteEvent,
)
from app.models.room import RoomState


class OperationError(Exception):
    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(reason)


def utc_now() -> datetime:
    return datetime.now(UTC)


class BoardService:
    """Applies serialized, server-authoritative board operations."""

    def _coordinate(self, value: float) -> float:
        if not math.isfinite(value) or abs(value) > settings.max_coordinate:
            raise OperationError("INVALID_COORDINATES")
        return value

    def _dimension(self, value: float) -> float:
        if not math.isfinite(value) or value <= 0 or value > settings.max_block_dimension:
            raise OperationError("INVALID_DIMENSIONS")
        return value

    def _text(self, value: str) -> str:
        if len(value) > settings.max_text_length:
            raise OperationError("TEXT_TOO_LONG")
        return value

    def _server_event(
        self,
        *,
        event_type: str,
        room: RoomState,
        user_id: str,
        operation_id: str,
        payload: dict,
    ) -> dict:
        return {
            "type": event_type,
            "roomId": room.room_id,
            "userId": user_id,
            "timestamp": utc_now().isoformat(),
            "operationId": operation_id,
            "version": room.version,
            "sequence": room.version,
            "payload": payload,
        }

    async def apply(self, room: RoomState, user_id: str, event) -> dict:
        operation_id = event.operation_id
        async with room.lock:
            operation_key = f"{user_id}:{operation_id}"
            cached = room.processed_operations.get(operation_key)
            if cached is not None:
                return cached

            if isinstance(event, BlockCreateEvent):
                result = self._create_block(room, user_id, event)
            elif isinstance(event, BlockMoveEvent):
                result = self._move_block(room, user_id, event)
            elif isinstance(event, BlockUpdateEvent):
                result = self._update_block(room, user_id, event)
            elif isinstance(event, BlockDeleteEvent):
                result = self._delete_block(room, user_id, event)
            elif isinstance(event, ConnectionCreateEvent):
                result = self._create_connection(room, user_id, event)
            elif isinstance(event, ConnectionDeleteEvent):
                result = self._delete_connection(room, user_id, event)
            else:
                raise OperationError("UNKNOWN_EVENT_TYPE")

            room.processed_operations[operation_key] = result
            return result

    def _create_block(self, room: RoomState, user_id: str, event: BlockCreateEvent) -> dict:
        payload = event.payload
        x = self._coordinate(payload.x)
        y = self._coordinate(payload.y)
        width = self._dimension(payload.width)
        height = self._dimension(payload.height)
        text = self._text(payload.text)
        room.version += 1
        block = Block(
            id=f"block-{uuid4().hex}",
            x=x,
            y=y,
            width=width,
            height=height,
            text=text,
            updatedAt=utc_now(),
            version=room.version,
        )
        room.blocks[block.id] = block
        return self._server_event(
            event_type="block_created",
            room=room,
            user_id=user_id,
            operation_id=event.operation_id,
            payload={"block": block.model_dump(mode="json", by_alias=True)},
        )

    def _move_block(self, room: RoomState, user_id: str, event: BlockMoveEvent) -> dict:
        block = room.blocks.get(event.payload.block_id)
        if block is None:
            raise OperationError("BLOCK_NOT_FOUND")
        x = self._coordinate(event.payload.x)
        y = self._coordinate(event.payload.y)
        room.version += 1
        block.x = x
        block.y = y
        block.updated_at = utc_now()
        block.version = room.version
        return self._server_event(
            event_type="block_moved",
            room=room,
            user_id=user_id,
            operation_id=event.operation_id,
            payload={"blockId": block.id, "x": block.x, "y": block.y},
        )

    def _update_block(self, room: RoomState, user_id: str, event: BlockUpdateEvent) -> dict:
        block = room.blocks.get(event.payload.block_id)
        if block is None:
            raise OperationError("BLOCK_NOT_FOUND")
        payload = event.payload
        if payload.text is None and payload.width is None and payload.height is None:
            raise OperationError("EMPTY_UPDATE")
        text = self._text(payload.text) if payload.text is not None else None
        width = self._dimension(payload.width) if payload.width is not None else None
        height = self._dimension(payload.height) if payload.height is not None else None
        room.version += 1
        if text is not None:
            block.text = text
        if width is not None:
            block.width = width
        if height is not None:
            block.height = height
        block.updated_at = utc_now()
        block.version = room.version
        return self._server_event(
            event_type="block_updated",
            room=room,
            user_id=user_id,
            operation_id=event.operation_id,
            payload={"block": block.model_dump(mode="json", by_alias=True)},
        )

    def _delete_block(self, room: RoomState, user_id: str, event: BlockDeleteEvent) -> dict:
        block_id = event.payload.block_id
        if block_id not in room.blocks:
            raise OperationError("BLOCK_NOT_FOUND")
        removed_connection_ids = [
            connection_id
            for connection_id, connection in room.connections.items()
            if connection.source_block_id == block_id or connection.target_block_id == block_id
        ]
        del room.blocks[block_id]
        for connection_id in removed_connection_ids:
            del room.connections[connection_id]
        room.version += 1
        return self._server_event(
            event_type="block_deleted",
            room=room,
            user_id=user_id,
            operation_id=event.operation_id,
            payload={"blockId": block_id, "removedConnectionIds": removed_connection_ids},
        )

    def _create_connection(
        self, room: RoomState, user_id: str, event: ConnectionCreateEvent
    ) -> dict:
        source_id = event.payload.source_block_id
        target_id = event.payload.target_block_id
        if source_id not in room.blocks or target_id not in room.blocks:
            raise OperationError("BLOCK_NOT_FOUND")
        if source_id == target_id:
            raise OperationError("SELF_CONNECTION_NOT_ALLOWED")
        if any(
            connection.source_block_id == source_id
            and connection.target_block_id == target_id
            for connection in room.connections.values()
        ):
            raise OperationError("CONNECTION_ALREADY_EXISTS")
        connection = Connection(
            id=f"connection-{uuid4().hex}",
            sourceBlockId=source_id,
            targetBlockId=target_id,
            type=event.payload.type,
        )
        room.connections[connection.id] = connection
        room.version += 1
        return self._server_event(
            event_type="connection_created",
            room=room,
            user_id=user_id,
            operation_id=event.operation_id,
            payload={"connection": connection.model_dump(mode="json", by_alias=True)},
        )

    def _delete_connection(
        self, room: RoomState, user_id: str, event: ConnectionDeleteEvent
    ) -> dict:
        connection_id = event.payload.connection_id
        if connection_id not in room.connections:
            raise OperationError("CONNECTION_NOT_FOUND")
        del room.connections[connection_id]
        room.version += 1
        return self._server_event(
            event_type="connection_deleted",
            room=room,
            user_id=user_id,
            operation_id=event.operation_id,
            payload={"connectionId": connection_id},
        )


board_service = BoardService()
