from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

from hotel_agent.application.dto import GeoFeatureRecord, SearchFactRecord, SearchHotelRecord
from hotel_agent.domain.query import Intent


@dataclass(frozen=True, slots=True)
class RequestedEvidence:
    intents: tuple[Intent, ...] = ()
    facts: tuple[SearchFactRecord, ...] = ()
    features: tuple[GeoFeatureRecord, ...] = ()


class RequestedEvidencePort(Protocol):
    async def check(
        self,
        term: str,
        hotels: Sequence[SearchHotelRecord],
        bbox: tuple[float, float, float, float] | None,
    ) -> RequestedEvidence: ...
