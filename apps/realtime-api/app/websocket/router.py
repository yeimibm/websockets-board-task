import json
import math
import time
from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.core.config import settings
from app.models.events import (
    MUTATION_TYPES,
    CursorMoveEvent,
    JoinRoomEvent,
    SnapshotRequestEvent,
    client_event_adapter,
)
from app.services.board_service import OperationError, board_service
from app.services.presence_service import presence_service
from app.websocket.connection_manager import connection_manager
from app.websocket.room_manager import room_manager

router = APIRouter()


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def event_message(
    event_type: str,
    room_id: str,
    user_id: str,
    payload: dict,
    *,
    version: int | None = None,
) -> dict:
    message: dict[str, object] = {
        "type": event_type,
        "roomId": room_id,
        "userId": user_id,
        "timestamp": now_iso(),
        "payload": payload,
    }
    if version is not None:
        message["version"] = version
        message["sequence"] = version
    return message


def rejection(
    room_id: str,
    user_id: str,
    reason: str,
    operation_id: str | None = None,
) -> dict:
    message = event_message(
        "operation_rejected",
        room_id,
        user_id,
        {"reason": reason},
    )
    if operation_id:
        message["operationId"] = operation_id
    return message


def snapshot_message(room, user_id: str) -> dict:
    return event_message(
        "room_snapshot",
        room.room_id,
        user_id,
        room.snapshot(),
        version=room.version,
    )


async def parse_json(websocket: WebSocket) -> dict | None:
    text = await websocket.receive_text()
    try:
        value = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
    return value if isinstance(value, dict) else None


async def remove_dead_participants(room, dead_sessions) -> None:
    for dead in dead_sessions:
        participant = presence_service.leave(room, dead.user_id)
        if participant is None:
            continue
        await connection_manager.broadcast(
            room.room_id,
            event_message(
                "participant_left",
                room.room_id,
                dead.user_id,
                {"id": dead.user_id},
            ),
        )


@router.websocket("/ws/rooms/{room_id}")
async def websocket_room(websocket: WebSocket, room_id: str) -> None:
    await connection_manager.accept(websocket)
    if not room_manager.is_valid_room_id(room_id):
        await connection_manager.send(websocket, rejection(room_id, "", "INVALID_ROOM_ID"))
        await websocket.close(code=1008)
        return

    session = None
    room = room_manager.get_or_create(room_id)
    try:
        raw_join = await parse_json(websocket)
        if raw_join is None:
            await connection_manager.send(websocket, rejection(room_id, "", "INVALID_MESSAGE"))
            await websocket.close(code=1008)
            return
        try:
            join_event = client_event_adapter.validate_python(raw_join)
        except ValidationError:
            await connection_manager.send(
                websocket,
                rejection(room_id, "", "INVALID_JOIN", raw_join.get("operationId")),
            )
            await websocket.close(code=1008)
            return
        if not isinstance(join_event, JoinRoomEvent):
            await connection_manager.send(websocket, rejection(room_id, "", "JOIN_REQUIRED"))
            await websocket.close(code=1008)
            return
        if join_event.room_id != room_id:
            await connection_manager.send(websocket, rejection(room_id, "", "ROOM_MISMATCH"))
            await websocket.close(code=1008)
            return

        async with room.lock:
            participant = presence_service.join(room, join_event.payload.name)
            session = connection_manager.register(websocket, room_id, participant.id)
            await connection_manager.send(websocket, snapshot_message(room, participant.id))

        joined = event_message(
            "participant_joined",
            room_id,
            participant.id,
            participant.model_dump(mode="json", by_alias=True),
        )
        dead = await connection_manager.broadcast(room_id, joined, exclude=websocket)
        await remove_dead_participants(room, dead)

        last_cursor_at = 0.0
        while True:
            raw_event = await parse_json(websocket)
            if raw_event is None:
                await connection_manager.send(
                    websocket,
                    rejection(room_id, participant.id, "INVALID_MESSAGE"),
                )
                continue
            try:
                client_event = client_event_adapter.validate_python(raw_event)
            except ValidationError:
                known_types = MUTATION_TYPES | {"cursor_move", "snapshot_request", "join_room"}
                reason = (
                    "INVALID_EVENT"
                    if raw_event.get("type") in known_types
                    else "UNKNOWN_EVENT_TYPE"
                )
                await connection_manager.send(
                    websocket,
                    rejection(room_id, participant.id, reason, raw_event.get("operationId")),
                )
                continue

            if isinstance(client_event, JoinRoomEvent):
                await connection_manager.send(
                    websocket,
                    rejection(room_id, participant.id, "ALREADY_JOINED"),
                )
                continue
            if client_event.room_id != room_id:
                await connection_manager.send(
                    websocket,
                    rejection(
                        room_id,
                        participant.id,
                        "ROOM_MISMATCH",
                        client_event.operation_id,
                    ),
                )
                continue
            if not client_event.user_id:
                await connection_manager.send(
                    websocket,
                    rejection(
                        room_id,
                        participant.id,
                        "USER_ID_REQUIRED",
                        client_event.operation_id,
                    ),
                )
                continue
            if client_event.user_id != participant.id:
                await connection_manager.send(
                    websocket,
                    rejection(
                        room_id,
                        participant.id,
                        "USER_MISMATCH",
                        client_event.operation_id,
                    ),
                )
                continue

            if isinstance(client_event, SnapshotRequestEvent):
                async with room.lock:
                    await connection_manager.send(
                        websocket,
                        snapshot_message(room, participant.id),
                    )
                continue

            if isinstance(client_event, CursorMoveEvent):
                x, y = client_event.payload.x, client_event.payload.y
                if (
                    not math.isfinite(x)
                    or not math.isfinite(y)
                    or abs(x) > settings.max_coordinate
                    or abs(y) > settings.max_coordinate
                ):
                    await connection_manager.send(
                        websocket,
                        rejection(room_id, participant.id, "INVALID_COORDINATES"),
                    )
                    continue
                current_time = time.monotonic()
                if current_time - last_cursor_at < 1 / settings.cursor_updates_per_second:
                    continue
                last_cursor_at = current_time
                cursor_event = event_message(
                    "cursor_move",
                    room_id,
                    participant.id,
                    {"x": x, "y": y},
                )
                dead = await connection_manager.broadcast(
                    room_id,
                    cursor_event,
                    exclude=websocket,
                )
                await remove_dead_participants(room, dead)
                continue

            try:
                accepted = await board_service.apply(room, participant.id, client_event)
            except OperationError as error:
                await connection_manager.send(
                    websocket,
                    rejection(
                        room_id,
                        participant.id,
                        error.reason,
                        client_event.operation_id,
                    ),
                )
                continue
            dead = await connection_manager.broadcast(room_id, accepted)
            await remove_dead_participants(room, dead)
    except WebSocketDisconnect:
        pass
    finally:
        removed_session = connection_manager.unregister(websocket) or session
        if removed_session is not None:
            left_participant = presence_service.leave(room, removed_session.user_id)
            if left_participant is not None:
                left_event = event_message(
                    "participant_left",
                    room_id,
                    removed_session.user_id,
                    {"id": removed_session.user_id},
                )
                dead = await connection_manager.broadcast(room_id, left_event)
                await remove_dead_participants(room, dead)
