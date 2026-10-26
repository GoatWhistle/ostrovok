from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from hotel_agent.application.agent.candidate_measurements import CandidateMeasurements
from hotel_agent.application.agent.coast_measurements import CoastMeasurements
from hotel_agent.application.agent.data_profile import profile_data
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.document_search import search_documents
from hotel_agent.application.agent.provider_content import ProviderContent
from hotel_agent.application.agent.record_reader import RecordReader
from hotel_agent.application.agent.research_tools import ResearchTools
from hotel_agent.application.agent.room_offer_tools import RoomOfferTools
from hotel_agent.application.agent.room_web_fallback import RoomWebFallback
from hotel_agent.application.agent.web_evidence import read_page_evidence
from hotel_agent.application.agent.wish_evidence import native_facts
from hotel_agent.application.dto import GeoFeatureRecord, SearchFactRecord, SearchHotelRecord
from hotel_agent.application.ports.data_exploration import (
    GeographicScopePort,
    TerrainMeasurementPort,
)
from hotel_agent.application.ports.destination_conditions import DestinationConditionsPort
from hotel_agent.application.ports.hotel_catalog import HotelCatalogSource
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.requested_evidence import RequestedEvidencePort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.domain.query import ParsedQuery

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
        native: RequestedEvidencePort | None = None,
        catalog: HotelCatalogSource | None = None,
        parsed: ParsedQuery | None = None,
    ) -> None:
        self._uow = uow
        self._terms = terms
        self._native, self._parsed = native, parsed
        self.has_native = native is not None
        self.allow_expand, self.discovery_allowed = allow_expand, discovery_allowed
        self._now = now or datetime.now(UTC)
        self.native_facts: dict[str, tuple[SearchFactRecord, ...]] = {}
        self.native_features: list[GeoFeatureRecord] = []
        self.native_required: dict[str, bool] = {}
        self._retrieved: list[dict[str, Any]] = []
        self._cache: dict[tuple[str, tuple[str, ...]], Sequence[dict[str, Any]]] = {}
        self.sources = {
            "database": True,
            "embeddings": semantic is not None,
            "provider": catalog is not None or (offers is not None and offers.configured),
            "web": web is not None,
            "geography": True,
            "environment": True,
        }

        self.city, self.region = city, region
        self._semantic = semantic
        self.metrics: dict[str, dict[str, float]] = {}
        self.descriptions: dict[str, str] = {}
        self.candidates = CandidateMeasurements(
            uow,
            terrain,
            hotels,
            city,
            region,
            bbox,
            allow_expand,
            country_scope,
            self.metrics,
            self.descriptions,
        )
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
        self.geo_refs: dict[str, dict[str, tuple[str, ...]]] = {}
        self.coast = CoastMeasurements(
            uow, lambda: self.hotels, self.metrics, self.descriptions, self.geo_refs
        )
        self.provider = ProviderContent(catalog, uow, lambda: self.hotels)
        self.room_web = RoomWebFallback(self.research, lambda: self.hotels, city, web is not None)

    @property
    def hotels(self) -> tuple[SearchHotelRecord, ...]:
        return self.candidates.hotels

    @hotels.setter
    def hotels(self, value: tuple[SearchHotelRecord, ...]) -> None:
        self.candidates.hotels = value

    @property
    def bbox(self) -> tuple[float, float, float, float] | None:
        return self.candidates.bbox

    async def execute(self, action: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if action == "check_requested":
            term = str(arguments.get("term") or self._terms[0])
            if self._native is None:
                return {"unavailable": True, "error": "Structured request tool is unavailable"}
            evidence = await self._native.check(term, self.hotels, self.bbox)
            records = native_facts(term, evidence, self._now)
            self.native_facts[term] = records
            self.native_features.extend(evidence.features)
            self.native_required[term] = any(item.required for item in evidence.intents)
            return {
                "matched_hotel_ids": [row.hotel_id for row in records if row.value is True],
                "record_count": len(records),
                "samples": [
                    {"hotel_id": row.hotel_id, "value": row.value, "explanation": row.explanation}
                    for row in records[:12]
                ],
                "checked_sources": ["database"],
            }
        if action == "match_records":
            return await self.reader.match(
                str(arguments.get("dataset", "documents")),
                self._terms[0] if self._terms else str(arguments.get("term", "")),
                int(arguments.get("offset", 0)),
                int(arguments.get("limit", 12)),
                arguments.get("hotel_ids") or (),
            )
        if action == "get_provider_content":
            result = await self.provider.read(arguments.get("hotel_ids") or ())
            return {
                **result,
                **await self.room_web.search(result.get("missing_room_hotel_ids", ())),
            }
        if action == "list_candidates":
            return self.candidates.list(arguments)
        if action == "read_web_page":
            return await read_page_evidence(
                self.research, self.reader, self._terms, arguments, self.hotels, self._records
            )
        if action == "get_room_offers":
            if self._parsed is not None:
                supplied = {
                    "check_in": self._parsed.check_in,
                    "check_out": self._parsed.check_out,
                    "adults": self._parsed.adults,
                }
                missing = [key for key, value in supplied.items() if value is None]
                if missing:
                    return {
                        "needs_input": missing,
                        "note": "Ask the user for missing stay details. Never invent them.",
                    }
                arguments = {
                    **arguments,
                    **{
                        key: str(value) if key != "adults" else value
                        for key, value in supplied.items()
                    },
                }
            result = await self.room_offers.execute(arguments)
            missing_ids = [
                row["hotel_id"]
                for row in result.get("hotels", ())
                if row["status"] in {"provider_unavailable", "hotel_unmapped", "provider_error"}
            ]
            return {**result, **await self.room_web.search(missing_ids)}
        if action == "measure_geometry":
            if arguments.get("dataset") != "coastlines":
                raise ValueError("Available geometry dataset: coastlines")
            return await self.coast.measure()
        if action == "search_documents":
            self.hotels, observation = await search_documents(
                self._semantic,
                self._uow,
                self.hotels,
                str(arguments.get("query", "")),
                self.discovery_allowed,
            )
            self._retrieved = [dict(item) for item in observation.get("hits", ())]
            return observation
        if action == "inspect_data":
            return await profile_data(
                self._records,
                (
                    *DATASETS,
                    "retrieved_documents",
                    "provider_hotels",
                    "provider_rooms",
                    "web_documents",
                ),
                len(self.hotels),
            )
        if action == "find_hotels":
            return await self.candidates.find_hotels(float(arguments.get("radius_m", 30000)))
        if action == "read_records":
            return await self.reader.read(
                str(arguments.get("dataset", "")), arguments.get("filters"), arguments.get("term")
            )
        if action == "measure_terrain":
            scope = None
            if arguments.get("search_radius_m") is not None:
                scope = await self.candidates.find_hotels(float(arguments["search_radius_m"]))
            result = await self.candidates.measure_terrain(float(arguments.get("radius_m", 1000)))
            if scope is not None:
                result["scope"] = scope
            return result
        return await self.research.execute(action, arguments)

    async def _records(self, dataset: str) -> Sequence[dict[str, Any]]:
        if dataset == "web_documents":
            return self.research.pages
        if dataset == "retrieved_documents":
            return self._retrieved
        if dataset == "provider_hotels":
            return self.provider.hotels
        if dataset == "provider_rooms":
            return self.provider.rooms + self.room_offers.records
        if dataset not in DATASETS:
            raise ValueError("Dataset is unavailable; inspect_data lists stored datasets")
        identity = (dataset, tuple(hotel.id for hotel in self.hotels))
        if identity not in self._cache:
            async with self._uow() as uow:
                self._cache[identity] = await uow.data.records(dataset, identity[1])
        return self._cache[identity]
