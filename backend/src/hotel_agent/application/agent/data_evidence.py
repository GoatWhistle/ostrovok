import hashlib
from datetime import datetime, timedelta

from hotel_agent.application.agent.data_records import DataCriterion, ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.evidence_summary import (
    CONFIRMED,
    QUOTED,
    confirmation,
    measured,
    quoted,
    sources,
    summary,
)
from hotel_agent.application.agent.record_filters import compare
from hotel_agent.application.agent.wish_evidence import wish_intent
from hotel_agent.application.dto import SearchFactRecord
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent


def materialize(
    query: str,
    terms: tuple[str, ...],
    criteria: tuple[DataCriterion, ...],
    tools: DataTools,
    now: datetime,
    question: str | None,
) -> ExplorationOutcome:
    intents: list[Intent] = []
    facts: list[SearchFactRecord] = []
    resolved: list[str] = []
    normalized = _normalize(query)
    for criterion in criteria:
        term = _normalize(criterion.term)
        source = _normalize(criterion.source_text)
        verified = criterion.source_text == criterion.term and all(
            tools.reader.verified_terms.get(check.field) == criterion.term
            for check in criterion.checks
        )
        if (
            criterion.term not in terms
            or not criterion.source_text.strip()
            or (_normalize(criterion.source_text) not in normalized and not verified)
            or (term in normalized and term not in source and source not in term)
            or not criterion.checks
            or len(criterion.checks) > 8
            or any(
                check.field not in tools.descriptions or check.op not in {"eq", "gte", "lte"}
                for check in criterion.checks
            )
        ):
            continue
        geometry = tuple(
            row
            for row in tools.native_facts.get(criterion.term, ())
            if row.method == "window_visibility@1"
        )
        if geometry:
            intents.append(wish_intent(criterion.term, criterion.required))
            facts.extend(geometry)
            if any(row.value is True for row in geometry):
                resolved.append(criterion.term)
            continue
        identity = repr((criterion.term, criterion.checks))
        key = f"derived:{hashlib.sha256(identity.encode()).hexdigest()[:12]}"
        records = []
        for hotel in tools.hotels:
            metrics = tools.metrics.get(hotel.id, {})
            if any(check.field not in metrics for check in criterion.checks):
                continue
            matches = [
                compare(metrics[check.field], check.op, check.value) for check in criterion.checks
            ]
            terrain = any(check.field.startswith("m") for check in criterion.checks)
            quotes = tuple(
                quote
                for check in criterion.checks
                for quote in tools.reader.quotes.get(hotel.id, {}).get(check.field, ())
            )
            urls = tuple(
                dict.fromkeys(
                    url
                    for check in criterion.checks
                    for url in (
                        *tools.reader.source_urls.get(hotel.id, {}).get(check.field, ()),
                        *tools.research.sources.get(hotel.id, {}).get(check.field, ()),
                    )
                )
            )
            titles = tuple(
                dict.fromkeys(
                    str(page["title"])
                    for page in tools.research.pages
                    if str(page.get("source_url", "")) in urls and page.get("title")
                )
            )
            event = (
                tools.places.event_note(hotel.id)
                if any(check.field.startswith("event") for check in criterion.checks)
                else None
            )
            clauses = (
                [event]
                if event
                else [
                    measured(
                        tools.descriptions[check.field],
                        metrics[check.field],
                        check.op,
                        check.value,
                    )
                    for check in criterion.checks[:2]
                ]
            )
            if not event and len(criterion.checks) > 2:
                clauses.append(f"и ещё условий: {len(criterion.checks) - 2}")
            if quotes and not event and _only_confirmations(criterion, tools):
                quote = quoted(quotes[0])
                if clauses[-1] == CONFIRMED:
                    clauses[-1] = f"{QUOTED}: {quote}"
                else:
                    clauses.append(quote)
            if terrain:
                clauses.append("Рельеф по Copernicus GLO-30, не вид из номера")
            if "scope.distance_m" in metrics:
                clauses.append(f"{metrics['scope.distance_m'] / 1000:.1f} км от центра города")
            if urls:
                clauses.append(sources(urls))
            explanation = summary(clauses)
            refs = {
                ref
                for check in criterion.checks
                for ref in (
                    *tools.geo_refs.get(hotel.id, {}).get(check.field, ()),
                    *tools.reader.geo_refs.get(hotel.id, {}).get(check.field, ()),
                    *tools.research.geo_refs.get(hotel.id, {}).get(check.field, ()),
                )
            }
            if terrain:
                refs.add(f"g_point_{hotel.location[0]:.6f}_{hotel.location[1]:.6f}")
            records.append(
                SearchFactRecord(
                    hotel_id=hotel.id,
                    id=f"f_{key.replace(':', '_')}_{hotel.id}",
                    characteristic_key=key,
                    value=all(matches),
                    unit=None,
                    qualifiers={
                        "estimated_location": True,
                        "source_text": criterion.source_text,
                        "source_quotes": list(quotes),
                        "source_urls": list(urls),
                        **({"source_titles": list(titles)} if quotes and titles else {}),
                        **(
                            {"catalogue_identity": list(tools.reader.identities[hotel.id])}
                            if quotes and hotel.id in tools.reader.identities
                            else {}
                        ),
                    },
                    source_type="computed",
                    source_id=urls[0] if urls else None,
                    method="data_agent_tools@1",
                    confidence=_confidence(criterion, metrics),
                    computed_at=now,
                    valid_until=now
                    + (
                        timedelta(minutes=10)
                        if any(c.field.startswith("offers") for c in criterion.checks)
                        else timedelta(hours=1)
                        if urls
                        else timedelta(days=1)
                    ),
                    status="active",
                    geo_refs=tuple(sorted(refs)),
                    explanation=explanation,
                    facade_azimuth=None,
                )
            )
        if not records:
            continue
        facts.extend(records)
        intents.append(
            Intent(
                characteristic_key=key,
                op=Op.EQ,
                value=True,
                weight=1,
                required=criterion.required,
                source_text=criterion.term
                if _normalize(criterion.term) in normalized
                else criterion.source_text,
            )
        )
        resolved.append(criterion.term)
    if intents and not any(intent.required for intent in intents):
        question = None
    if intents and question is None:
        keys = (
            {item.characteristic_key for item in intents}
            if any(item.required for item in intents)
            else set()
        )
        by_hotel: dict[str, dict[str, bool]] = {}
        for record in facts:
            by_hotel.setdefault(record.hotel_id, {})[record.characteristic_key] = (
                record.value is True
            )
        if keys and not any(
            keys <= set(values) and all(values[key] for key in keys) for values in by_hotel.values()
        ):
            wanted = "; ".join(f"«{term}»" for term in resolved)
            question = f"В проверенных данных не нашёл отель, который одновременно соответствует условиям {wanted}. Какое условие или область поиска можно изменить?"
    return ExplorationOutcome(
        hotels=tools.hotels,
        intents=tuple(intents),
        facts=tuple(facts),
        resolved_terms=tuple(resolved),
        bbox=tools.bbox,
        question=question,
    )


def _only_confirmations(criterion: DataCriterion, tools: DataTools) -> bool:
    return all(confirmation(tools.descriptions.get(check.field, "")) for check in criterion.checks)


def _confidence(criterion: DataCriterion, metrics: dict[str, float]) -> float:
    margins = []
    for check in criterion.checks:
        if not isinstance(check.value, int | float) or isinstance(check.value, bool):
            continue
        scale = max(abs(check.value), 1)
        margin = (metrics[check.field] - check.value) / scale
        if check.op == "lte":
            margin = -margin
        margins.append(min(1, max(0, margin)))
    return 0.65 + 0.15 * (sum(margins) / len(margins) if margins else 0)


def _normalize(value: str) -> str:
    return " ".join(value.casefold().replace("ё", "е").split())
