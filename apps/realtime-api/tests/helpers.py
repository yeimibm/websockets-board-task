from datetime import UTC, datetime
from uuid import uuid4


def join(websocket, room_id: str, name: str) -> dict:
    websocket.send_json(
        {
            "type": "join_room",
            "roomId": room_id,
            "userId": "",
            "timestamp": datetime.now(UTC).isoformat(),
            "payload": {"name": name},
        }
    )
    snapshot = websocket.receive_json()
    assert snapshot["type"] == "room_snapshot"
    return snapshot


def operation(
    event_type: str,
    room_id: str,
    user_id: str,
    payload: dict,
    *,
    operation_id: str | None = None,
) -> dict:
    message = {
        "type": event_type,
        "roomId": room_id,
        "userId": user_id,
        "timestamp": datetime.now(UTC).isoformat(),
        "payload": payload,
    }
    if operation_id is not None or event_type not in {"cursor_move", "snapshot_request"}:
        message["operationId"] = operation_id or str(uuid4())
    return message


def create_block(websocket, room_id: str, user_id: str, text: str = "API") -> dict:
    websocket.send_json(
        operation(
            "block_create",
            room_id,
            user_id,
            {"x": 20, "y": 30, "width": 180, "height": 90, "text": text},
        )
    )
    event = websocket.receive_json()
    assert event["type"] == "block_created"
    return event

