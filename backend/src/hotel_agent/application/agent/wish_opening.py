from dataclasses import dataclass
from typing import Any

from hotel_agent.application.agent.data_records import ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.proximity_terms import named_place
from hotel_agent.application.agent.wish_evidence import wish_intent
from hotel_agent.application.agent.wish_ledger import WishLedger
from hotel_agent.application.ports.log import LoggerPort

PROBE_RADIUS_M = 20000


@dataclass(frozen=True, slots=True)
class Opening:
    observations: tuple[dict[str, Any], ...] = ()
    retained: ExplorationOutcome | None = None
    matched: bool = False


async def open_wish(term: str, tools: DataTools, ledger: WishLedger, logger: LoggerPort) -> Opening:
    observations: list[dict[str, Any]] = []
    retained: ExplorationOutcome | None = None
    matched = False
    kept = await tools.remembered(term)
    if kept:
        logger.info("wish_recalled", wish=term, hotels=len({row.hotel_id for row in kept}))
        return Opening(
            (),
            ExplorationOutcome(
                hotels=tools.hotels,
                bbox=tools.bbox,
                intents=(wish_intent(term, tools.native_required.get(term, False)),),
                facts=kept,
            ),
            True,
        )
    if tools.has_native:
        result = await tools.execute("check_requested", {"term": term})
        ledger.observe("check_requested", {"term": term}, result)
        observations.append(
            {"tool": "check_requested", "arguments": {"term": term}, "result": result}
        )
        rows = tools.native_facts.get(term, ())
        if rows:
            retained = ExplorationOutcome(
                hotels=tools.hotels,
                bbox=tools.bbox,
                intents=(wish_intent(term, tools.native_required.get(term, False)),),
                facts=rows,
            )
            matched = any(row.value is True for row in rows)
    else:
        observations.append(
            {
                "tool": "inspect_data",
                "arguments": {},
                "result": await tools.execute("inspect_data", {}),
            }
        )
    if matched:
        return Opening(tuple(observations), retained, True)
    observations.extend(await _place_probe(term, tools, ledger, logger))
    return Opening(tuple(observations), retained, False)


async def _place_probe(
    term: str, tools: DataTools, ledger: WishLedger, logger: LoggerPort
) -> list[dict[str, Any]]:
    place = named_place(term)
    if not place:
        return []
    arguments = {"name": place, "radius_m": PROBE_RADIUS_M}
    try:
        result = await tools.execute("find_nearby", arguments)
    except (ValueError, TypeError, KeyError) as error:
        result = {"error": str(error)}
    ledger.observe("find_nearby", arguments, result)
    logger.info(
        "wish_place_probe",
        wish=term,
        place=place,
        matched=result.get("hotels_with_match", 0),
        nearest=(result.get("matches") or [{}])[0].get("nearest_m"),
    )
    return [{"tool": "find_nearby", "arguments": arguments, "result": result}]
