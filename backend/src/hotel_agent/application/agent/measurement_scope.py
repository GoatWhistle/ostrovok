import json
from datetime import datetime

from hotel_agent.application.agent.data_records import DataCriterion
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.ports.llm import LLMPort


def needs_scope_check(criteria: tuple[DataCriterion, ...]) -> bool:
    return any(
        check.field.startswith(("env", "view", "offers", "r"))
        for criterion in criteria
        for check in criterion.checks
    )


async def verify_measurement_scope(
    llm: LLMPort,
    query: str,
    criteria: tuple[DataCriterion, ...],
    tools: DataTools,
    now: datetime,
) -> tuple[tuple[DataCriterion, ...], tuple[str, ...]]:
    selected = {
        str(i): criterion
        for i, criterion in enumerate(criteria)
        if needs_scope_check((criterion,))
        and all(check.field in tools.descriptions for check in criterion.checks)
        and any(
            check.field.startswith(("env", "view", "offers"))
            or (
                check.field.startswith("r")
                and tools.reader.verified_terms.get(check.field) != criterion.term
            )
            for check in criterion.checks
        )
    }
    if not selected:
        return criteria, ()
    sources = {
        key: json.dumps(
            {
                "wish": criterion.term,
                "source_text": criterion.source_text,
                "checks": [
                    {
                        "field": check.field,
                        "description": tools.descriptions.get(check.field),
                        "source_filter": tools.reader.field_context.get(check.field),
                        "op": check.op,
                        "threshold": check.value,
                    }
                    for check in criterion.checks
                ],
                "measurements": {
                    hotel.id: {
                        check.field: tools.metrics.get(hotel.id, {}).get(check.field)
                        for check in criterion.checks
                    }
                    for hotel in tools.hotels
                    if any(
                        check.field in tools.metrics.get(hotel.id, {}) for check in criterion.checks
                    )
                },
            },
            ensure_ascii=False,
        )
        for key, criterion in selected.items()
    }
    verdicts = await llm.verify_evidence(
        json.dumps(
            {
                "mode": "measurement_scope",
                "request": query,
                "now": now.isoformat(),
                "wish": "Проверь соответствие измерений пожеланию, включая дату, время и единицы",
                "records": [
                    {"record_id": key, "source_text": text} for key, text in sources.items()
                ],
            },
            ensure_ascii=False,
        )
    )
    accepted = {
        v.record_id
        for v in verdicts
        if v.supported
        and v.record_id in sources
        and len(v.quote.strip()) >= 12
        and v.quote in sources[v.record_id]
    }
    rejected = tuple(criterion.term for key, criterion in selected.items() if key not in accepted)
    return tuple(
        criterion
        for i, criterion in enumerate(criteria)
        if str(i) not in selected or str(i) in accepted
    ), rejected
