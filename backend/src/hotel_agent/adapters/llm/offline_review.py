import json
from collections.abc import Sequence

from hotel_agent.application.ports.text_evidence import EvidenceVerdict


def review_typed_recommendations(context: str) -> Sequence[EvidenceVerdict]:
    payload = json.loads(context)
    if payload.get("mode") != "recommendation_scope":
        return ()
    results = []
    for record in payload.get("records", ()):
        evidence = json.loads(record["source_text"])
        facts = evidence.get("facts", ())
        positive = [row.get("fact") for row in facts if row.get("quality") in {"full", "partial"}]
        supported = (bool(positive) or not facts) and all(
            isinstance(fact, dict)
            and fact.get("value") is True
            and fact.get("qualifiers", {}).get("native_characteristic_key")
            and fact.get("qualifiers", {}).get("native_value") is not None
            for fact in positive
        )
        results.append(
            EvidenceVerdict(
                record_id=record["record_id"], supported=supported, quote=record["source_text"]
            )
        )
    return tuple(results)
