from collections.abc import Sequence
from datetime import UTC, datetime
from math import cos, hypot, radians
from statistics import median
from typing import Any

from hotel_agent.application.agent.data_profile import profile_data
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.document_search import search_documents
from hotel_agent.application.agent.record_reader import RecordReader
from hotel_agent.application.agent.research_tools import ResearchTools
from hotel_agent.application.agent.room_offer_tools import RoomOfferTools
from hotel_agent.application.agent.web_evidence import read_page_evidence
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.data_exploration import (
    GeographicScopePort,
    TerrainMeasurementPort,
)
from hotel_agent.application.ports.destination_conditions import DestinationConditionsPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.application.spatial_matching import distance_m
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers

DATASETS = ("hotels", "rooms", "facilities", "documents", "onsite_objects")


class DataTools:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        terrain: TerrainMeasurementPort,
        hotels: Sequence[SearchHotelRecord],
        city: str,
        region: str,
        bbox: tuple[float, float, float, float] | None,
        allow_expand: bool,
        country_scope: GeographicScopePort | None = None,
        semantic: SemanticSearchPort | None = None,
        discovery_allowed: bool = False,
        evidence: DocumentEvidence | None = None,
        web: WebResearchPort | None = None,
        conditions: DestinationConditionsPort | None = None,
        now: datetime | None = None,
        view: ViewAssessmentPort | None = None,
        offers: GetHotelOffers | None = None,
        terms: tuple[str, ...] = (),
    ) -> None:
        self._uow, self._terrain = uow, terrain
        self._terms = terms
        self.hotels = tuple(hotels)
        self.city, self.region, self.bbox = city, region, bbox
        self._allow_expand = allow_expand
        self._country_scope = country_scope
        self._semantic = semantic
        self._discovery_allowed = discovery_allowed
        self.metrics: dict[str, dict[str, float]] = {}
        self.descriptions: dict[str, str] = {}
        self.reader = RecordReader(self._records, self.metrics, self.descriptions, evidence)
        self.research = ResearchTools(
            lambda: self.hotels,
            self.metrics,
            self.descriptions,
            web,
            conditions,
            now or datetime.now(UTC),
            view,
        )
        self.room_offers = RoomOfferTools(
            offers, lambda: self.hotels, self.metrics, self.descriptions
        )
        self._measurements = 0
        self._geometry_reads = 0
        self.geo_refs: dict[str, dict[str, tuple[str, ...]]] = {}

    async def execute(self, action: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if action == "read_web_page":
            return await read_page_evidence(
                self.research, self.reader, self._terms, arguments, self.hotels, self._records
            )
        if action == "get_room_offers":
            return await self.room_offers.execute(arguments)
        if action == "measure_geometry":
            if arguments.get("dataset") != "coastlines":
                raise ValueError("Available geometry dataset: coastlines")
            return await self._coast()
        if action == "search_documents":
            self.hotels, observation = await search_documents(
                self._semantic,
                self._uow,
                self.hotels,
                str(arguments.get("query", "")),
                self._discovery_allowed,
            )
            return observation
        if action == "inspect_data":
            return await profile_data(self._records, DATASETS, len(self.hotels))
        if action == "find_hotels":
            return await self._find(float(arguments.get("radius_m", 30000)))
        if action == "read_records":
            return await self.reader.read(
                str(arguments.get("dataset", "")), arguments.get("filters"), arguments.get("term")
            )
        if action == "measure_terrain":
            scope = None
            if arguments.get("search_radius_m") is not None:
                scope = await self._find(float(arguments["search_radius_m"]))
            result = await self._measure(float(arguments.get("radius_m", 1000)))
            if scope is not None:
                result["scope"] = scope
            return result
        return await self.research.execute(action, arguments)

    async def _coast(self) -> dict[str, Any]:
        async with self._uow() as uow:
            points = await uow.coastlines.nearest_points(tuple(h.id for h in self.hotels))
        self._geometry_reads += 1
        field = f"g{self._geometry_reads}.distance_m"
        self.descriptions[field] = "Расстояние до известной береговой линии по прямой, м"
        measured = []
        for hotel in self.hotels:
            if hotel.id not in points:
                continue
            coast = points[hotel.id]
            value = round(distance_m(hotel.location, coast), 1)
            self.metrics.setdefault(hotel.id, {})[field] = value
            self.geo_refs.setdefault(hotel.id, {})[field] = (
                f"g_point_{hotel.location[0]:.6f}_{hotel.location[1]:.6f}",
                f"g_point_{coast[0]:.6f}_{coast[1]:.6f}",
            )
            measured.append({"hotel_id": hotel.id, "name": hotel.name, "distance_m": value})
        return {
            "field": field,
            "source": "OpenStreetMap coastline",
            "measured_count": len(measured),
            "nearest": sorted(measured, key=lambda row: float(str(row["distance_m"])))[:12],
            "note": "Straight-line distance only; does not establish walking time or access.",
        }

    async def _records(self, dataset: str) -> Sequence[dict[str, Any]]:
        if dataset == "web_documents":
            return self.research.pages
        if dataset not in DATASETS:
            raise ValueError("Available datasets: hotels, rooms, facilities")
        async with self._uow() as uow:
            return await uow.data.records(dataset, tuple(hotel.id for hotel in self.hotels))

    async def _find(self, radius: float) -> dict[str, Any]:
        if not self._allow_expand:
            raise ValueError(
                "The search has an explicit geographic boundary; expansion is not allowed"
            )
        if not 1000 <= radius <= 50000 or not self.hotels:
            raise ValueError("Search radius must be 1000–50000 m with a known city")
        async with self._uow() as uow:
            center = await uow.regions.city_center(self.city)
            if center is None:
                center = (
                    median(hotel.location[0] for hotel in self.hotels),
                    median(hotel.location[1] for hotel in self.hotels),
                )
            dy = radius / 111200
            dx = dy / max(cos(radians(center[1])), 0.1)
            bbox = (center[0] - dx, center[1] - dy, center[0] + dx, center[1] + dy)
            found = await uow.search.list_hotels(self.region, bbox)
        combined = {hotel.id: hotel for hotel in (*self.hotels, *found)}
        distances = {
            hotel.id: hypot(
                (hotel.location[0] - center[0]) * cos(radians(center[1])),
                hotel.location[1] - center[1],
            )
            * 111200
            for hotel in combined.values()
        }
        selected = sorted(
            (
                hotel
                for hotel in combined.values()
                if distances[hotel.id] <= radius
                and (self._country_scope is None or self._country_scope.contains(hotel.location))
            ),
            key=lambda hotel: (distances[hotel.id], hotel.id),
        )[:500]
        for hotel in selected:
            self.metrics.setdefault(hotel.id, {})["scope.distance_m"] = round(distances[hotel.id])
        self.descriptions["scope.distance_m"] = "Расстояние по прямой до точки города, м"
        self.hotels = tuple(selected)
        if self.bbox is not None:
            bbox = (
                min(bbox[0], self.bbox[0]),
                min(bbox[1], self.bbox[1]),
                max(bbox[2], self.bbox[2]),
                max(bbox[3], self.bbox[3]),
            )
        self.bbox = bbox
        return {
            "hotel_count": len(selected),
            "radius_m": radius,
            "bbox": bbox,
            "available_before_limit": len(combined),
            "limit": 500,
            "country_scope_checked": self._country_scope is not None,
            "samples": [
                {
                    "id": h.id,
                    "name": h.name,
                    "location": h.location,
                    "distance_from_city_m": round(distances[h.id]),
                }
                for h in selected[:8]
            ],
        }

    async def _measure(self, radius: float) -> dict[str, Any]:
        measured = await self._terrain.measure({h.id: h.location for h in self.hotels}, radius)
        self._measurements += 1
        prefix = f"m{self._measurements}"
        for hotel_id, row in measured.items():
            for key, value in row.items():
                self.metrics.setdefault(hotel_id, {})[f"{prefix}.{key}"] = value
        self.descriptions[f"{prefix}.elevation_m"] = "Высота над уровнем моря, м"
        self.descriptions[f"{prefix}.relief_m"] = (
            f"Перепад высот по 9 точкам в радиусе {radius:g} м"
        )
        summary = {}
        for field in ("elevation_m", "relief_m"):
            values = [row[field] for row in measured.values() if field in row]
            if values:
                summary[f"{prefix}.{field}"] = {
                    "min": min(values),
                    "median": median(values),
                    "max": max(values),
                    "count": len(values),
                }
        names = {h.id: h.name for h in self.hotels}
        ordered = sorted(measured, key=lambda key: -measured[key].get("elevation_m", 0))
        return {
            "fields": summary,
            "source": "Copernicus GLO-30 / Mapterhorn DEM",
            "radius_m": radius,
            "hotel_count": len(self.hotels),
            "measured_count": len(measured),
            "highest": [
                {"hotel_id": key, "name": names.get(key), **measured[key]} for key in ordered[:12]
            ],
            "note": "Ground height and sampled relief are approximate; no room or view evidence",
        }
