from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator


class EventModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class JoinPayload(EventModel):
    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value


class CursorPayload(EventModel):
    x: float
    y: float


class BlockCreatePayload(EventModel):
    x: float
    y: float
    width: float
    height: float
    text: str


class BlockMovePayload(EventModel):
    block_id: str = Field(alias="blockId", min_length=1, max_length=100)
    x: float
    y: float


class BlockUpdatePayload(EventModel):
    block_id: str = Field(alias="blockId", min_length=1, max_length=100)
    text: str | None = None
    width: float | None = None
    height: float | None = None


class BlockDeletePayload(EventModel):
    block_id: str = Field(alias="blockId", min_length=1, max_length=100)


class ConnectionCreatePayload(EventModel):
    source_block_id: str = Field(alias="sourceBlockId", min_length=1, max_length=100)
    target_block_id: str = Field(alias="targetBlockId", min_length=1, max_length=100)
    type: Literal["arrow", "line"] = "arrow"


class ConnectionDeletePayload(EventModel):
    connection_id: str = Field(alias="connectionId", min_length=1, max_length=100)


class SnapshotRequestPayload(EventModel):
    pass


class ClientEventBase(EventModel):
    room_id: str = Field(alias="roomId")
    user_id: str | None = Field(default=None, alias="userId")
    timestamp: datetime | None = None
    operation_id: str | None = Field(default=None, alias="operationId", max_length=100)


class JoinRoomEvent(ClientEventBase):
    type: Literal["join_room"]
    payload: JoinPayload


class CursorMoveEvent(ClientEventBase):
    type: Literal["cursor_move"]
    payload: CursorPayload


class BlockCreateEvent(ClientEventBase):
    type: Literal["block_create"]
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    payload: BlockCreatePayload


class BlockMoveEvent(ClientEventBase):
    type: Literal["block_move"]
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    payload: BlockMovePayload


class BlockUpdateEvent(ClientEventBase):
    type: Literal["block_update"]
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    payload: BlockUpdatePayload


class BlockDeleteEvent(ClientEventBase):
    type: Literal["block_delete"]
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    payload: BlockDeletePayload


class ConnectionCreateEvent(ClientEventBase):
    type: Literal["connection_create"]
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    payload: ConnectionCreatePayload


class ConnectionDeleteEvent(ClientEventBase):
    type: Literal["connection_delete"]
    operation_id: str = Field(alias="operationId", min_length=1, max_length=100)
    payload: ConnectionDeletePayload


class SnapshotRequestEvent(ClientEventBase):
    type: Literal["snapshot_request"]
    payload: SnapshotRequestPayload = Field(default_factory=SnapshotRequestPayload)


ClientEvent = Annotated[
    JoinRoomEvent | CursorMoveEvent | BlockCreateEvent | BlockMoveEvent | BlockUpdateEvent | BlockDeleteEvent | ConnectionCreateEvent | ConnectionDeleteEvent | SnapshotRequestEvent,
    Field(discriminator="type"),
]

client_event_adapter: TypeAdapter[ClientEvent] = TypeAdapter(ClientEvent)


MUTATION_TYPES = {
    "block_create",
    "block_move",
    "block_update",
    "block_delete",
    "connection_create",
    "connection_delete",
}
