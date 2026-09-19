from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.websocket.connection_manager import connection_manager
from app.websocket.room_manager import room_manager


@pytest.fixture(autouse=True)
def reset_in_memory_state() -> Iterator[None]:
    room_manager.rooms.clear()
    connection_manager._connections.clear()
    yield
    room_manager.rooms.clear()
    connection_manager._connections.clear()


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client

