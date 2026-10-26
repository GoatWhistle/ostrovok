from dataclasses import dataclass
from typing import Protocol

from hotel_agent.domain.hotel_identity import HotelCandidate


@dataclass(frozen=True, slots=True)
class DiscoveryResult:
    candidates: tuple[HotelCandidate, ...]
    complete: bool


class HotelDiscoveryPort(Protocol):
    async def nearby(self, location: tuple[float, float]) -> DiscoveryResult: ...


class CatalogProviderFailure(Exception):
    pass
