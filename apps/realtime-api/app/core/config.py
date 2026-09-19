from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "Collaborative Board Realtime API"
    cursor_updates_per_second: int = 30
    max_text_length: int = 500
    max_coordinate: float = 100_000.0
    max_block_dimension: float = 5_000.0


settings = Settings()

