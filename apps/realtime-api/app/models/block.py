from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Block(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    x: float
    y: float
    width: float = Field(gt=0)
    height: float = Field(gt=0)
    text: str
    updated_at: datetime = Field(alias="updatedAt")
    version: int = Field(ge=1)

