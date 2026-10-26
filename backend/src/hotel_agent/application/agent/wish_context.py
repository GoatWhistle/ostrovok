import json
from datetime import datetime
from typing import Any

KEPT_IN_FULL = 2
OLDER_TEXT_LIMIT = 700
TRUNCATED = "… обрезано; перечитай страницу или записи, если нужен полный текст"

from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_ledger import WishLedger


def compact(value: Any) -> Any:
    if isinstance(value, str):
        return value[:OLDER_TEXT_LIMIT] + TRUNCATED if len(value) > OLDER_TEXT_LIMIT else value
    if isinstance(value, dict):
        return {key: compact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [compact(item) for item in value]
    return value


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
            "observations": [
                *(compact(row) for row in observations[:-KEPT_IN_FULL]),
                *observations[-KEPT_IN_FULL:],
            ],
        },
        ensure_ascii=False,
    )
