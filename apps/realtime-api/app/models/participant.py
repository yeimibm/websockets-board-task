from pydantic import BaseModel, ConfigDict, Field


class Participant(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str = Field(min_length=1, max_length=60)
    color: str
    connected: bool = True

