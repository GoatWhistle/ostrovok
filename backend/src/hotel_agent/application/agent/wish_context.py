import json
from datetime import datetime
from typing import Any

from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_ledger import WishLedger


def wish_context(
    query: str,
    term: str,
    tools: DataTools,
    ledger: WishLedger,
    observations: list[dict[str, Any]],
    remaining: int,
    now: datetime,
) -> str:
    return json.dumps(
        {
            "now": now.isoformat(),
            "query": query,
            "terms": [term],
            "current_wish": term,
            "city": tools.city,
            "candidate_count": len(tools.hotels),
            "bbox": tools.bbox,
            "allow_expand": tools.allow_expand,
            "discovery_allowed": tools.discovery_allowed,
            "remaining_steps": remaining,
            "remaining_tool_calls": remaining,
            "available_sources": tools.sources,
            "checked_sources": sorted(ledger.checked),
            "pending_pages": ledger.pending_pages,
            "observations": observations,
        },
        ensure_ascii=False,
    )
