import hashlib
from collections.abc import Sequence
from dataclasses import replace
from datetime import datetime, timedelta

from hotel_agent.application.agent.evidence_summary import brief, summary
from hotel_agent.application.agent.wish_records import WishResult
from hotel_agent.application.dto import SearchFactRecord, SearchHotelRecord
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.requested_evidence import RequestedEvidence
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent
from hotel_agent.domain.services.scoring import MatchQuality, match


def wish_key(term: str) -> str:
    return "derived:" + hashlib.sha256(("wish@1:" + term).encode()).hexdigest()[:12]


def wish_intent(term: str, required: bool = False) -> Intent:
    return Intent(
        characteristic_key=wish_key(term),
        op=Op.EQ,
        value=True,
        weight=1,
        required=required,
        source_text=term,
    )


def native_facts(
    term: str, evidence: RequestedEvidence, now: datetime
) -> tuple[SearchFactRecord, ...]:
    intents = tuple(i for i in evidence.intents if not i.characteristic_key.startswith("facility:"))
    result: list[SearchFactRecord] = []
    ranks = {
        MatchQuality.FULL: 3,
        MatchQuality.PARTIAL: 2,
        MatchQuality.NONE: 1,
        MatchQuality.UNKNOWN: 0,
    }
    for index, intent in enumerate(intents):
        selected: dict[str, tuple[int, int, float, SearchFactRecord]] = {}
        for row in evidence.facts:
            if row.characteristic_key != intent.characteristic_key:
                continue
            fact = fact_from_record(row)
            matched = match(intent, fact, now)
            unrestricted = match(intent, replace(fact, qualifiers={}), now)
            rank = (ranks[matched.quality], ranks[unrestricted.quality], row.confidence)
            if row.hotel_id in selected and rank <= selected[row.hotel_id][:3]:
                continue
            value = (
                True
                if matched.quality in {MatchQuality.FULL, MatchQuality.PARTIAL}
                else False
                if matched.quality is MatchQuality.NONE
                else None
            )
            qualifiers = {
                **row.qualifiers,
                "source_text": term,
                "native_characteristic_key": row.characteristic_key,
                "native_value": row.value,
                "native_unit": row.unit,
                "native_op": str(intent.op),
                "native_threshold": intent.value,
            }
            if matched.quality is MatchQuality.PARTIAL:
                qualifiers["estimated_match"] = True
            selected[row.hotel_id] = (
                rank[0],
                rank[1],
                rank[2],
                replace(
                    row,
                    characteristic_key=str(index),
                    value=value,
                    unit=None,
                    qualifiers=qualifiers,
                ),
            )
        result.extend(row for _, _, _, row in selected.values())
    return relabel_facts(term, result, {str(i) for i in range(len(intents))})


def unresolved_facts(
    result: WishResult,
    hotels: Sequence[SearchHotelRecord],
    now: datetime,
) -> tuple[SearchFactRecord, ...]:
    return tuple(
        SearchFactRecord(
            hotel_id=hotel.id,
            id=f"f_wish_{wish_key(result.term)[8:]}_{hotel.id}",
            characteristic_key=wish_key(result.term),
            value=None,
            unit=None,
            qualifiers={
                "source_text": result.term,
                "wish_status": result.status,
                "checked_sources": list(result.checked_sources),
                "tool_calls": result.tool_calls,
            },
            source_type="computed",
            source_id=None,
            method="wish_agent@1",
            confidence=0.2,
            computed_at=now,
            valid_until=now + timedelta(minutes=10),
            status="active",
            geo_refs=(),
            explanation=brief(result.reason),
            facade_azimuth=None,
        )
        for hotel in hotels
    )


def relabel_facts(
    term: str,
    rows: Sequence[SearchFactRecord],
    required_keys: set[str] | None = None,
) -> tuple[SearchFactRecord, ...]:
    keys = required_keys if required_keys is not None else {row.characteristic_key for row in rows}
    grouped: dict[str, dict[str, SearchFactRecord]] = {}
    for row in rows:
        grouped.setdefault(row.hotel_id, {})[row.characteristic_key] = row
    result: list[SearchFactRecord] = []
    for hotel_id, by_key in grouped.items():
        selected = tuple(by_key.values())
        value = (
            False
            if any(row.value is False for row in selected)
            else None
            if not keys <= by_key.keys() or any(row.value is None for row in selected)
            else True
        )
        first = next((row for row in selected if row.value is value), selected[0])
        result.append(
            replace(
                first,
                id=f"f_wish_{wish_key(term)[8:]}_{hotel_id}",
                characteristic_key=wish_key(term),
                value=value,
                confidence=min(row.confidence for row in selected),
                geo_refs=tuple(dict.fromkeys(ref for row in selected for ref in row.geo_refs)),
                explanation=summary(row.explanation for row in selected),
                qualifiers={
                    **first.qualifiers,
                    "source_text": term,
                    **(
                        {"estimated_match": True}
                        if any(row.qualifiers.get("estimated_match") for row in selected)
                        else {}
                    ),
                },
            )
        )
    return tuple(result)
