from app.websocket.room_manager import room_manager

from .helpers import create_block, join, operation


def test_room_id_contract_matches_shared_link_requirements():
    assert room_manager.is_valid_room_id("team_board-7")
    assert room_manager.is_valid_room_id("A")
    assert room_manager.is_valid_room_id("a" * 64)

    assert not room_manager.is_valid_room_id("team board")
    assert not room_manager.is_valid_room_id("-starts-with-symbol")
    assert not room_manager.is_valid_room_id("a" * 65)


def test_two_clients_connect_to_same_room_and_receive_presence(client):
    with client.websocket_connect("/ws/rooms/team") as alice:
        alice_snapshot = join(alice, "team", "Alice")
        with client.websocket_connect("/ws/rooms/team") as bob:
            bob_snapshot = join(bob, "team", "Bob")
            joined = alice.receive_json()

            assert joined["type"] == "participant_joined"
            assert joined["payload"]["name"] == "Bob"
            assert len(bob_snapshot["payload"]["participants"]) == 2
            assert alice_snapshot["version"] == 0


def test_change_from_one_client_is_broadcast_to_another(client):
    with client.websocket_connect("/ws/rooms/shared") as alice:
        alice_id = join(alice, "shared", "Alice")["userId"]
        with client.websocket_connect("/ws/rooms/shared") as bob:
            join(bob, "shared", "Bob")
            alice.receive_json()  # Bob joined.

            created_for_alice = create_block(alice, "shared", alice_id)
            created_for_bob = bob.receive_json()

            assert created_for_bob == created_for_alice
            assert created_for_bob["payload"]["block"]["text"] == "API"


def test_rooms_are_isolated_and_cross_room_claim_is_rejected(client):
    with client.websocket_connect("/ws/rooms/room-a") as alice:
        alice_id = join(alice, "room-a", "Alice")["userId"]
        with client.websocket_connect("/ws/rooms/room-b") as bob:
            bob_id = join(bob, "room-b", "Bob")["userId"]
            create_block(alice, "room-a", alice_id)

            bob.send_json(
                operation(
                    "block_create",
                    "room-a",
                    bob_id,
                    {"x": 1, "y": 1, "width": 10, "height": 10, "text": "attack"},
                )
            )
            rejected = bob.receive_json()

            assert rejected["type"] == "operation_rejected"
            assert rejected["payload"]["reason"] == "ROOM_MISMATCH"
            assert len(room_manager.rooms["room-a"].blocks) == 1
            assert room_manager.rooms["room-b"].blocks == {}


def test_late_join_receives_current_snapshot(client):
    with client.websocket_connect("/ws/rooms/late") as alice:
        alice_id = join(alice, "late", "Alice")["userId"]
        created = create_block(alice, "late", alice_id, "Existing block")

        with client.websocket_connect("/ws/rooms/late") as bob:
            snapshot = join(bob, "late", "Bob")

            assert snapshot["version"] == 1
            assert snapshot["payload"]["blocks"] == [created["payload"]["block"]]


def test_disconnecting_participant_updates_presence(client):
    with client.websocket_connect("/ws/rooms/presence") as alice:
        join(alice, "presence", "Alice")
        with client.websocket_connect("/ws/rooms/presence") as bob:
            bob_id = join(bob, "presence", "Bob")["userId"]
            alice.receive_json()  # Bob joined.
        left = alice.receive_json()

        assert left["type"] == "participant_left"
        assert left["payload"]["id"] == bob_id
        assert bob_id not in room_manager.rooms["presence"].participants
