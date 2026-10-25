from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Protocol

from hotel_agent.application.dto import Feature


class SeedReaderPort(Protocol):
    def read_meta(self, directory: Path) -> Mapping[str, object]: ...

    def read_layer(self, directory: Path, name: str) -> Sequence[Feature]: ...


class SeedWriterPort(Protocol):
    async def upsert_region(self, region: str, meta: Mapping[str, object]) -> None: ...

    async def save_layer(self, region: str, name: str, features: Sequence[Feature]) -> int: ...

    async def link_hotels(self, region: str) -> int: ...

    async def commit(self) -> None: ...
