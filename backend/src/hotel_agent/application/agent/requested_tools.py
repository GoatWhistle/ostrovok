from collections.abc import Sequence

from hotel_agent.application.dto import (
    GeoFeatureRecord,
    NamedPlaceRecord,
    SearchFactRecord,
    SearchHotelRecord,
)
from hotel_agent.application.geographic_distance import geographic_distance
from hotel_agent.application.landmark_resolution import LandmarkResolver
from hotel_agent.application.nearby_matching import nearby_key, nearby_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.geographic_objects import GeographicObjectsPort
from hotel_agent.application.ports.place_lookup import PlaceLookupPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.requested_evidence import RequestedEvidence
from hotel_agent.application.spatial_matching import spatial_fact
from hotel_agent.application.spatial_resolution import resolve_spatial_requests
from hotel_agent.application.use_cases.evaluate_window_views import EvaluateWindowViews
from hotel_agent.domain.query import ParsedQuery


class RequestedTools:
    def __init__(
        self,
        parsed: ParsedQuery,
        city: str,
        region: str,
        uow: UnitOfWorkFactory,
        clock: ClockPort,
        place: PlaceLookupPort | None,
        windows: EvaluateWindowViews | None,
        landmarks: LandmarkResolver | None = None,
        geographic_objects: GeographicObjectsPort | None = None,
    ) -> None:
        self._parsed, self._city, self._region = parsed, city, region
        self._landmarks = landmarks
        self._geographic_objects = geographic_objects
        self._uow, self._clock, self._place, self._windows = uow, clock, place, windows

    async def check(
        self,
        term: str,
        hotels: Sequence[SearchHotelRecord],
        bbox: tuple[float, float, float, float] | None,
    ) -> RequestedEvidence:
        intents = tuple(intent for intent in self._parsed.intents if intent.source_text == term)
        keys = [
            intent.characteristic_key
            for intent in intents
            if not intent.characteristic_key.startswith(("spatial:", "nearby:", "facility:"))
        ]
        nearby = [request for request in self._parsed.nearby_objects if request.source_text == term]
        spatial = [
            request for request in self._parsed.spatial_requests if request.source_text == term
        ]
        spatial_bbox = bbox
        if spatial_bbox is None and hotels:
            spatial_bbox = (
                min(h.location[0] for h in hotels) - 0.1,
                min(h.location[1] for h in hotels) - 0.1,
                max(h.location[0] for h in hotels) + 0.1,
                max(h.location[1] for h in hotels) + 0.1,
            )
        now = self._clock.now()
        records: list[SearchFactRecord] = []
        features: list[GeoFeatureRecord] = []
        async with self._uow() as uow:
            if keys:
                records.extend(
                    await uow.search.list_facts(
                        None, hotel_ids=[h.id for h in hotels], characteristic_keys=keys
                    )
                )
            for request in nearby:
                matches = await uow.nearby_objects.list_matches(self._region, request, bbox)
                found = {item for ids in matches.values() for item in ids}
                named = (
                    await uow.geo_features.get_batch(sorted(f"g_poi_{item}" for item in found))
                    if found
                    else ()
                )
                names = {str(row.osm_ref): row.name for row in named if row.osm_ref and row.name}
                records.extend(
                    nearby_record(
                        h.id, nearby_key(request), request, matches.get(h.id, ()), now, names
                    )
                    for h in hotels
                )
            targets = await resolve_spatial_requests(uow, spatial, self._city, bbox, hotels)
            sea = (
                await uow.coastlines.nearest_points(tuple(h.id for h in hotels))
                if any(request.kind == "sea_view" for request in spatial)
                else {}
            )
        for spatial_request, target in targets:
            ambiguous = False
            if self._landmarks and spatial_bbox and spatial_request.kind == "landmark_view":
                resolution = await self._landmarks(
                    spatial_request,
                    self._city,
                    spatial_bbox,
                    target if isinstance(target, NamedPlaceRecord) else None,
                )
                target, ambiguous = resolution.place, resolution.ambiguous
            if (
                target is None
                and not ambiguous
                and spatial_request.kind not in {"city_center", "sea_view"}
                and self._place is not None
                and spatial_bbox is not None
            ):
                position = await self._place.coordinates(spatial_request.target or "", spatial_bbox)
                if position is not None:
                    async with self._uow() as uow:
                        target = await uow.named_places.near_coordinate(position, spatial_bbox)
            if spatial_request.kind in {"landmark_view", "sea_view"}:
                if self._windows is not None:
                    by_hotel = (
                        sea
                        if spatial_request.kind == "sea_view"
                        else {h.id: target for h in hotels if target is not None}
                    )
                    evaluated = await self._windows(hotels, spatial_request, by_hotel, now)
                    records.extend(evaluated.facts)
                    features.extend(evaluated.features)
            elif target is not None:
                geometry = (
                    await self._geographic_objects.get(target.id)
                    if self._geographic_objects is not None and isinstance(target, NamedPlaceRecord)
                    else None
                )
                if geometry is not None and isinstance(target, NamedPlaceRecord):
                    for hotel in hotels:
                        fact, feature = geographic_distance(
                            spatial_request, hotel, target, geometry, now
                        )
                        records.append(fact)
                        features.append(feature)
                else:
                    records.extend(spatial_fact(spatial_request, h, target, now) for h in hotels)
        return RequestedEvidence(intents, tuple(records), tuple(features))
