import json
from dataclasses import asdict, dataclass

from hotel_agent.application.agent.semantic_review import ReviewClaim, SemanticReview
from hotel_agent.application.dto import NamedPlaceRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.query import SpatialRequest


@dataclass(frozen=True, slots=True)
class LandmarkResolution:
    place: NamedPlaceRecord | None
    ambiguous: bool = False


class LandmarkResolver:
    def __init__(self, uow: UnitOfWorkFactory, review: SemanticReview) -> None:
        self._uow, self._review = uow, review
        self._cache: dict[str, LandmarkResolution] = {}

    async def __call__(
        self,
        request: SpatialRequest,
        city: str,
        bbox: tuple[float, float, float, float],
        fallback: NamedPlaceRecord | None,
    ) -> LandmarkResolution:
        key = json.dumps(
            [
                request.target,
                city,
                bbox,
                request.target_osm_key,
                request.target_osm_values,
                request.source_text,
            ]
        )
        if key in self._cache:
            return self._cache[key]
        async with self._uow() as uow:
            candidates = tuple(
                await uow.named_places.candidates(
                    request.target or "", bbox, request.target_osm_key, request.target_osm_values
                )
            )
        if not candidates:
            return LandmarkResolution(fallback)
        if len(candidates) == 1:
            return LandmarkResolution(candidates[0])
        claims = tuple(
            ReviewClaim(
                id=place.id,
                answer=json.dumps(
                    {
                        "requested_target": request.target,
                        "city": city,
                        "selected_object_id": place.id,
                    },
                    ensure_ascii=False,
                ),
                evidence=json.dumps(asdict(place), ensure_ascii=False),
            )
            for place in candidates
        )
        result = await self._review.check(
            f"Ориентир: {request.target}. Место поиска: {city}. Пожелание: {request.source_text}",
            "landmark_identity",
            claims,
        )
        accepted = [place for place in candidates if place.id in result.accepted_ids]
        identities = {place.tags.get("wikidata") for place in accepted}
        unique = len(accepted) == 1 or (
            bool(accepted) and len(identities) == 1 and None not in identities
        )
        resolved = LandmarkResolution(accepted[0] if unique else None, ambiguous=not unique)
        self._cache[key] = resolved
        return resolved
