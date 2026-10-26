from collections.abc import Sequence
from typing import Any

from hotel_agent.application.agent.candidate_lookup import lookup_candidates
from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.semantic_search import SemanticSearchPort


async def search_documents(
    semantic: SemanticSearchPort | None,
    uow_factory: UnitOfWorkFactory,
    hotels: Sequence[SearchHotelRecord],
    query: str,
    discovery_allowed: bool,
    identity_records: Sequence[dict[str, Any]] = (),
) -> tuple[tuple[SearchHotelRecord, ...], dict[str, Any]]:
    if semantic is None:
        return tuple(hotels), {
            "catalogue_candidates": lookup_candidates(hotels, identity_records, {"query": query}),
            "hits": [],
            "unavailable": True,
            "note": "Semantic retrieval is not configured",
        }
    hits = await semantic.search(
        query, None if discovery_allowed else tuple(h.id for h in hotels), 12
    )
    if discovery_allowed:
        async with uow_factory() as uow:
            found = await uow.search.by_ids(tuple(dict.fromkeys(d.hotel_id for d in hits)))
        hotels = tuple({h.id: h for h in (*hotels, *found)}.values())[:500]
    priorities = {
        hotel_id: index
        for index, hotel_id in enumerate(dict.fromkeys(hit.hotel_id for hit in hits))
    }
    hotels = tuple(sorted(hotels, key=lambda hotel: priorities.get(hotel.id, len(priorities))))
    return tuple(hotels), {
        "catalogue_candidates": lookup_candidates(hotels, identity_records, {"query": query}),
        "hits": [
            {
                "id": d.id,
                "hotel_id": d.hotel_id,
                "hotel_name": d.hotel_name,
                "website": d.website,
                "text": d.text,
                "source": d.source,
                "source_url": d.website,
                "relevance": d.relevance,
            }
            for d in hits
        ],
        "note": "Relevance only. Inspect quoted source text; similarity is not a fact.",
    }
