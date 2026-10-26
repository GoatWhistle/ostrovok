import asyncio
from collections.abc import Awaitable, Callable, Sequence
from typing import Any
from urllib.parse import urlsplit

from hotel_agent.application.agent.record_reader import RecordReader
from hotel_agent.application.agent.research_tools import ResearchTools
from hotel_agent.application.dto import SearchHotelRecord


async def read_page_evidence(
    research: ResearchTools,
    reader: RecordReader,
    terms: tuple[str, ...],
    arguments: dict[str, Any],
    hotels: Sequence[SearchHotelRecord],
    records: Callable[[str], Awaitable[Sequence[dict[str, Any]]]],
) -> dict[str, Any]:
    arguments = dict(arguments)
    ids = arguments.get("hotel_ids") or []
    selected = arguments.get("hotel_id") or (ids[0] if len(ids) == 1 else None)
    if selected not in {hotel.id for hotel in hotels}:
        host = (urlsplit(str(arguments.get("url", ""))).hostname or "").removeprefix("www.")
        websites = await records("hotels")
        matches = [
            row
            for row in websites
            if host
            and (urlsplit(str(row.get("tags", {}).get("website", ""))).hostname or "").removeprefix(
                "www."
            )
            == host
        ]
        if len(matches) == 1:
            arguments["hotel_id"] = str(matches[0]["hotel_id"])
    result = await research.execute("read_web_page", arguments)
    if not terms or not result.get("hotel_id"):
        return result
    selected_terms = (arguments["term"],) if arguments.get("term") in terms else terms[:4]
    checks = await asyncio.gather(
        *(
            reader.read(
                "web_documents",
                [
                    {"field": "hotel_id", "op": "eq", "value": result["hotel_id"]},
                    {"field": "source_url", "op": "eq", "value": result["source_url"]},
                ],
                term,
            )
            for term in selected_terms
        )
    )
    result["evidence"] = checks
    result["fields"] = {
        check["field"]: "Проверенное подтверждение пожелания на странице"
        for check in checks
        if "field" in check
    }
    return result
