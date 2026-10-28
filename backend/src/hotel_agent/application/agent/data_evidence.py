import hashlib
import re
from datetime import datetime, timedelta

from hotel_agent.application.agent.data_records import DataCriterion, ExplorationOutcome
from hotel_agent.application.agent.data_tools import DataTools
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
            measured = "; ".join(
                f"{tools.descriptions[check.field]}: {metrics[check.field]:g}"
                for check in criterion.checks
            )
            terrain = any(check.field.startswith("m") for check in criterion.checks)
            operators = {"gte": "не менее", "lte": "не более", "eq": "равно"}
            rules = "; ".join(
                f"{tools.descriptions[check.field]} — {operators[check.op]} {check.value:g}"
                for check in criterion.checks
            )
            explanation = f"{measured}. Проверка пожелания: {rules}. Оценочные критерии выбраны агентом по доступным данным."
            if terrain:
                explanation += " Источник: Copernicus GLO-30 / Mapterhorn DEM; оценка местности, не вида из номера."
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
            if quotes:
                explanation += " Цитаты источника: " + " ".join(
                    f"«{quote[:300]}»" for quote in quotes[:2]
                )
            if urls:
                explanation += " Источники: " + ", ".join(urls)
            if "scope.distance_m" in metrics:
                explanation += (
                    f" До точки города по прямой {metrics['scope.distance_m'] / 1000:.1f} км."
                )
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
            question = conflict_question(query, resolved)
    return ExplorationOutcome(
        hotels=tools.hotels,
        intents=tuple(intents),
        facts=tuple(facts),
        resolved_terms=tuple(resolved),
        bbox=tools.bbox,
        question=question,
    )


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


CYRILLIC = re.compile(r"[Ѐ-ӿ]")


def conflict_question(query: str, terms: list[str]) -> str:
    if CYRILLIC.search(query):
        wanted = ", ".join(f"«{term}»" for term in terms)
        return f"Ни один проверенный отель не подходит одновременно под {wanted}. Что можно ослабить?"
    wanted = ", ".join(f"“{term}”" for term in terms)
    return f"No verified hotel matches {wanted} at once. Which condition can I relax?"
