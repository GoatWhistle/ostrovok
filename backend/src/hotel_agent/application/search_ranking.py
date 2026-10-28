from collections.abc import Mapping
from math import inf

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.services.scoring import COUNTED_QUALITIES, Scored


def search_rank(
    hotel: SearchHotelRecord, scored: Scored
) -> tuple[float, int, float, bool, bool, int]:
    computed_views = 0
    for match in scored.matches:
        if match.fact is None:
            continue
        visibility = match.fact.qualifiers.get("visibility")
        if isinstance(visibility, Mapping):
            computed_views += (
                2
                if visibility.get("target_location")
                else int(visibility.get("calculation_attempted") is True)
            )
    return (
        -scored.score,
        -computed_views,
        closeness(scored),
        hotel.name == hotel.id,
        hotel.name.startswith("#"),
        -(hotel.stars or 0),
    )


def closeness(scored: Scored) -> float:
    ratios: list[float] = []
    for match in scored.matches:
        if match.fact is None or match.quality not in COUNTED_QUALITIES:
            continue
        measured = _measured(match.fact.value, match.intent.value, match.intent.op)
        native = _measured(
            match.fact.qualifiers.get("native_value"),
            match.fact.qualifiers.get("native_threshold"),
            match.fact.qualifiers.get("native_op"),
        )
        ratio = measured if measured is not None else native
        if ratio is not None:
            ratios.append(ratio)
    return sum(ratios) / len(ratios) if ratios else inf


def _measured(value: object, wanted: object, op: object) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    if isinstance(wanted, bool) or not isinstance(wanted, int | float) or wanted <= 0:
        return None
    if op == Op.LTE and value >= 0:
        return value / wanted
    if op == Op.GTE and value > 0:
        return wanted / value
    return None


def view_eligible(scored: Scored) -> bool:
    views: list[bool] = []
    for match in scored.matches:
        if match.fact is None or not match.fact.provenance.method.startswith("window_visibility@"):
            continue
        visibility = match.fact.qualifiers.get("visibility")
        if isinstance(visibility, Mapping):
            attempted = visibility.get("calculation_attempted") is not False
            if match.intent.required and not attempted:
                return False
            views.append(attempted)
    return not views or any(views)
