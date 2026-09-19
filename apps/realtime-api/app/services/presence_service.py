from uuid import uuid4

from app.models.participant import Participant
from app.models.room import RoomState

COLORS = (
    "#6366F1",
    "#EC4899",
    "#14B8A6",
    "#F59E0B",
    "#8B5CF6",
    "#EF4444",
    "#06B6D4",
    "#84CC16",
)


class PresenceService:
    def join(self, room: RoomState, name: str) -> Participant:
        used_colors = {participant.color for participant in room.participants.values()}
        color = next((candidate for candidate in COLORS if candidate not in used_colors), None)
        if color is None:
            color = COLORS[len(room.participants) % len(COLORS)]
        participant = Participant(
            id=f"user-{uuid4().hex}",
            name=name.strip(),
            color=color,
        )
        room.participants[participant.id] = participant
        return participant

    def leave(self, room: RoomState, user_id: str) -> Participant | None:
        return room.participants.pop(user_id, None)


presence_service = PresenceService()

