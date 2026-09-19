from .helpers import create_block, join


def test_reconnection_receives_updated_authoritative_snapshot(client):
    with client.websocket_connect("/ws/rooms/reconnect") as first_socket:
        first_user_id = join(first_socket, "reconnect", "Alice")["userId"]
        created = create_block(first_socket, "reconnect", first_user_id, "Persisted")

    with client.websocket_connect("/ws/rooms/reconnect") as reconnected_socket:
        snapshot = join(reconnected_socket, "reconnect", "Alice")

        assert snapshot["version"] == created["version"]
        assert snapshot["payload"]["blocks"] == [created["payload"]["block"]]
        assert snapshot["userId"] != first_user_id

