from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from hotel_agent.application.agent.record_filters import fields
from hotel_agent.application.agent.record_preview import preview


async def profile_data(
    records: Callable[[str], Awaitable[Sequence[dict[str, Any]]]],
    datasets: Sequence[str],
    hotel_count: int,
) -> dict[str, Any]:
    profiles = {}
    for dataset in datasets:
        rows = await records(dataset)
        profiles[dataset] = {
            "record_count": len(rows),
            "fields": fields(rows),
            "hotels_with_records": len({row["hotel_id"] for row in rows}),
            "samples": preview(rows[:3]),
        }
    return {"hotel_count": hotel_count, "datasets": profiles}
