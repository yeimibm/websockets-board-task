from app.websocket.room_manager import room_manager

from .helpers import create_block, join, operation


def test_deleting_block_removes_related_connections(client):
    with client.websocket_connect("/ws/rooms/graph") as websocket:
        user_id = join(websocket, "graph", "Alice")["userId"]
        first_id = create_block(websocket, "graph", user_id, "A")["payload"]["block"]["id"]
        second_id = create_block(websocket, "graph", user_id, "B")["payload"]["block"]["id"]
        websocket.send_json(
            operation(
                "connection_create",
                "graph",
                user_id,
                {"sourceBlockId": first_id, "targetBlockId": second_id},
            )
        )
        connection_id = websocket.receive_json()["payload"]["connection"]["id"]

        websocket.send_json(
            operation("block_delete", "graph", user_id, {"blockId": first_id})
        )
        deleted = websocket.receive_json()

        assert deleted["type"] == "block_deleted"
        assert deleted["payload"]["removedConnectionIds"] == [connection_id]
        assert room_manager.rooms["graph"].connections == {}


def test_invalid_event_is_rejected_without_incrementing_version(client):
    with client.websocket_connect("/ws/rooms/validation") as websocket:
        user_id = join(websocket, "validation", "Alice")["userId"]
        websocket.send_json(
            operation(
                "block_move",
                "validation",
                user_id,
                {"blockId": "missing", "x": 10, "y": 20},
            )
        )
        rejected = websocket.receive_json()

        assert rejected["type"] == "operation_rejected"
        assert rejected["payload"]["reason"] == "BLOCK_NOT_FOUND"
        assert room_manager.rooms["validation"].version == 0


def test_cursor_is_ephemeral_and_does_not_change_board_state(client):
    with client.websocket_connect("/ws/rooms/cursors") as alice:
        alice_id = join(alice, "cursors", "Alice")["userId"]
        with client.websocket_connect("/ws/rooms/cursors") as bob:
            join(bob, "cursors", "Bob")
            alice.receive_json()
            alice.send_json(
                operation("cursor_move", "cursors", alice_id, {"x": 403, "y": 218})
            )
            cursor = bob.receive_json()

            assert cursor["type"] == "cursor_move"
            assert cursor["payload"] == {"x": 403.0, "y": 218.0}
            room = room_manager.rooms["cursors"]
            assert room.version == 0
            assert not hasattr(room, "cursors")


def test_version_increases_for_each_accepted_mutation(client):
    with client.websocket_connect("/ws/rooms/versions") as websocket:
        user_id = join(websocket, "versions", "Alice")["userId"]
        created = create_block(websocket, "versions", user_id)
        block_id = created["payload"]["block"]["id"]
        websocket.send_json(
            operation(
                "block_move",
                "versions",
                user_id,
                {"blockId": block_id, "x": 500, "y": 240},
            )
        )
        moved = websocket.receive_json()
        websocket.send_json(
            operation(
                "block_update",
                "versions",
                user_id,
                {"blockId": block_id, "text": "Updated"},
            )
        )
        updated = websocket.receive_json()

        assert [created["version"], moved["version"], updated["version"]] == [1, 2, 3]
        assert updated["sequence"] == 3
        assert room_manager.rooms["versions"].blocks[block_id].text == "Updated"

