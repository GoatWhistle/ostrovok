from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any

from hotel_agent.application.agent.candidate_lookup import lookup_candidates
from hotel_agent.application.agent.candidate_measurements import CandidateMeasurements
from hotel_agent.application.agent.catalogue_links import catalogue_names
from hotel_agent.application.agent.coast_measurements import CoastMeasurements
from hotel_agent.application.agent.data_profile import profile_data
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.document_search import search_documents
from hotel_agent.application.agent.event_discovery import search_events
from hotel_agent.application.agent.event_venues import event_providers
from hotel_agent.application.agent.place_proximity import PlaceProximity
from hotel_agent.application.agent.place_tools import ACTIONS, PlaceTools
from hotel_agent.application.agent.provider_content import ProviderContent
from hotel_agent.application.agent.record_reader import RecordReader
from hotel_agent.application.agent.research_tools import ResearchTools
from hotel_agent.application.agent.room_offer_tools import RoomOfferTools
from hotel_agent.application.agent.room_web_fallback import RoomWebFallback
from hotel_agent.application.agent.source_records import DATASETS, SourceRecords
from hotel_agent.application.agent.web_evidence import read_page_evidence
from hotel_agent.application.agent.wish_evidence import native_facts
from hotel_agent.application.dto import GeoFeatureRecord, SearchFactRecord, SearchHotelRecord
from hotel_agent.application.ports.data_exploration import (
    GeographicScopePort,
    TerrainMeasurementPort,
)
from hotel_agent.application.ports.destination_conditions import DestinationConditionsPort
from hotel_agent.application.ports.hotel_catalog import HotelCatalogSource
from hotel_agent.application.ports.llm import LLMPort
from hotel_agent.application.ports.place_research import PlaceResearchPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.requested_evidence import RequestedEvidencePort
from hotel_agent.application.ports.semantic_search import SemanticSearchPort
from hotel_agent.application.ports.view_assessment import ViewAssessmentPort
from hotel_agent.application.ports.web_research import WebResearchPort
from hotel_agent.application.use_cases.get_hotel_details import GetHotelDetails
from hotel_agent.application.use_cases.get_hotel_offers import GetHotelOffers
from hotel_agent.domain.query import ParsedQuery


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
        places: Mapping[str, PlaceResearchPort] | None = None,
        llm: LLMPort | None = None,
        details: GetHotelDetails | None = None,
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
        self.sources = {
            "database": True,
            "embeddings": semantic is not None,
            "provider": catalog is not None
            or (offers is not None and offers.configured)
            or (details is not None and details.configured),
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
        self.records = SourceRecords(
            uow,
            lambda: self.hotels,
            {
                "web_documents": lambda: self.research.pages,
                "provider_hotels": lambda: self.provider.hotels,
                "provider_rooms": lambda: self.provider.rooms + self.room_offers.records,
                "events": lambda: self.places.events,
            },
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
        self.nearby = PlaceProximity(
            uow,
            region,
            lambda: self.hotels,
            lambda: self.bbox,
            self.metrics,
            self.descriptions,
            self.geo_refs,
        )
        self.provider = ProviderContent(catalog, uow, lambda: self.hotels, details)
        self.room_web = RoomWebFallback(self.research, lambda: self.hotels, city, web is not None)

        self.places = PlaceTools(
            event_providers(places or {}, web, uow, llm, city, bbox),
            lambda: self.hotels,
            self.metrics,
            self.descriptions,
            self.research.sources,
            self.research.geo_refs,
            self.reader,
            terms,
            self._now,
        )

    @property
    def hotels(self) -> tuple[SearchHotelRecord, ...]:
        return self.candidates.hotels

    @hotels.setter
    def hotels(self, value: tuple[SearchHotelRecord, ...]) -> None:
        self.candidates.hotels = value

    @property
    def bbox(self) -> tuple[float, float, float, float] | None:
        return self.candidates.bbox

    async def _named_query(self, arguments: dict[str, Any]) -> str:
        query = str(arguments.get("query") or "").strip()
        rows = await self._records("hotels")
        wanted = str(arguments["hotel_id"])
        row = next((item for item in rows if str(item.get("hotel_id")) == wanted), None)
        if row is None:
            return query
        tags = row.get("tags")
        names = catalogue_names(
            {
                **({"name": row["name"]} if row.get("name") else {}),
                **(tags if isinstance(tags, dict) else {}),
            }
        )
        spare = [name for name in names[:3] if name.casefold() not in query.casefold()]
        return " ".join([query, *(f'"{name}"' for name in spare)]).strip() if spare else query

    async def execute(self, action: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if action == "search_web" and arguments.get("hotel_id"):
            arguments = {**arguments, "query": await self._named_query(arguments)}
        if action == "search_events":
            return await search_events(self.places, self.research, self.city, arguments, self._now)
        if action in ACTIONS:
            return await self.places.execute(action, arguments)
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
            return lookup_candidates(self.hotels, await self._records("hotels"), arguments)
        if action == "read_web_page":
            return await read_page_evidence(
                self.research, self.reader, self._terms, arguments, self.hotels, self._records
            )
        if action == "get_room_offers":
            result = await self.room_offers.execute(arguments, self._parsed)
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
                await self._records("hotels"),
            )
            self.records.retrieved = [dict(item) for item in observation.get("hits", ())]
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
        if action == "find_nearby":
            return await self.nearby.find(arguments)
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
        return await self.records.read(dataset)
