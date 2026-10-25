from collections.abc import Sequence
from typing import Any

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.semantic_search import SemanticSearchPort


async def search_documents(
    semantic: SemanticSearchPort | None,
    uow_factory: UnitOfWorkFactory,
    hotels: Sequence[SearchHotelRecord],
    query: str,
    discovery_allowed: bool,
) -> tuple[tuple[SearchHotelRecord, ...], dict[str, Any]]:
    if semantic is None:
        return tuple(hotels), {"hits": [], "note": "Semantic retrieval is not configured"}
    hits = await semantic.search(
        query, None if discovery_allowed else tuple(h.id for h in hotels), 12
    )
    if discovery_allowed:
        async with uow_factory() as uow:
            found = await uow.search.by_ids(tuple(dict.fromkeys(d.hotel_id for d in hits)))
        hotels = tuple({h.id: h for h in (*hotels, *found)}.values())[:500]
    return tuple(hotels), {
        "hits": [
            {
                "id": d.id,
                "hotel_id": d.hotel_id,
                "text": d.text,
                "source": d.source,
                "relevance": d.relevance,
            }
            for d in hits
        ],
        "note": "Relevance only. Inspect quoted source text; similarity is not a fact.",
    }
