from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Connection(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    source_block_id: str = Field(alias="sourceBlockId")
    target_block_id: str = Field(alias="targetBlockId")
    type: Literal["arrow", "line"] = "arrow"

