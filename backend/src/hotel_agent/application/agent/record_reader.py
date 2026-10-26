import json
from collections import Counter
from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from hotel_agent.application.agent.candidate_lookup import identity_tags
from hotel_agent.application.agent.document_evidence import DocumentEvidence
from hotel_agent.application.agent.record_filters import compare, field_value, fields
from hotel_agent.application.agent.record_preview import preview


class RecordReader:
    def __init__(
        self,
        records: Callable[[str], Awaitable[Sequence[dict[str, Any]]]],
        metrics: dict[str, dict[str, float]],
        descriptions: dict[str, str],
        evidence: DocumentEvidence | None = None,
    ) -> None:
        self._records, self._metrics, self._descriptions = records, metrics, descriptions
        self._evidence = evidence
        self._reads = 0
        self.verified_terms: dict[str, str] = {}
        self.field_context: dict[str, str] = {}
        self.quotes: dict[str, dict[str, tuple[str, ...]]] = {}
        self.identities: dict[str, tuple[str, ...]] = {}
        self.source_urls: dict[str, dict[str, tuple[str, ...]]] = {}
        self.geo_refs: dict[str, dict[str, tuple[str, ...]]] = {}

    async def match(
        self,
        dataset: str,
        term: str,
        offset: int = 0,
        limit: int = 12,
        hotel_ids: Sequence[str] = (),
    ) -> dict[str, Any]:
        if offset < 0 or not 1 <= limit <= 12:
            raise ValueError("Use a nonnegative offset and a page of 1–12 records")
        rows = await self._records(dataset)
        selected = [row for row in rows if not hotel_ids or row["hotel_id"] in hotel_ids]
        batch = selected[offset : offset + limit]
        matched = await self._evidence.verify(term, batch, ()) if self._evidence else []
        self._reads += 1
        field = f"r{self._reads}.match_count"
        self.remember_identity(matched)
        for hotel_id in dict.fromkeys(str(row["hotel_id"]) for row in matched):
            supported = [row for row in matched if str(row["hotel_id"]) == hotel_id]
            self._metrics.setdefault(hotel_id, {})[field] = float(len(supported))
            self.quotes.setdefault(hotel_id, {})[field] = tuple(
                str(row["_evidence_quote"]) for row in supported
            )
            self.source_urls.setdefault(hotel_id, {})[field] = tuple(
                str(row["source_url"]) for row in supported if row.get("source_url")
            )
            self.geo_refs.setdefault(hotel_id, {})[field] = tuple(
                str(row["geo_ref"]) for row in supported if row.get("geo_ref")
            )
        self._descriptions[field] = "Подтверждения смысла пожелания цитатой из источника"
        self.verified_terms[field] = term
        return {
            "dataset": dataset,
            "field": field,
            "record_count": len(selected),
            "examined_count": len(batch),
            "matched_record_count": len(matched),
            "matched_hotel_ids": list(dict.fromkeys(str(row["hotel_id"]) for row in matched)),
            "samples": preview(matched),
            "offset": offset,
            "next_offset": offset + len(batch) if offset + len(batch) < len(selected) else None,
            "has_more": offset + len(batch) < len(selected),
            "note": "Semantic verification with exact source quotes; unchecked records remain unknown.",
        }

    def remember_identity(self, rows: Sequence[dict[str, Any]]) -> None:
        for row in rows:
            identity = row.get("hotel_identity")
            if not isinstance(identity, dict):
                continue
            tags = identity.get("tags")
            names = {
                **({"name": identity["name"]} if identity.get("name") else {}),
                **(identity_tags(tags) if isinstance(tags, dict) else {}),
            }
            if names:
                self.identities[str(row["hotel_id"])] = tuple(
                    f"{key}={value}" for key, value in sorted(names.items())
                )

    async def read(self, dataset: str, filters: Any, term: str | None = None) -> dict[str, Any]:
        if not isinstance(filters, list) or not filters or len(filters) > 8:
            raise ValueError("Supply 1–8 filters with field, op and value")
        rows = await self._records(dataset)
        available = fields(rows)
        if not rows:
            return {
                "dataset": dataset,
                "record_count": 0,
                "metrics": [],
                "note": "No inventory; absence of records does not prove absence of a feature",
            }
        for item in filters:
            if not isinstance(item, dict) or item.get("field") not in available:
                raise ValueError(f"Unknown field; available fields: {available}")
            if item.get("op") not in {"eq", "contains", "gte", "lte"}:
                raise ValueError("Supported filter operators: eq, contains, gte, lte")
        coverage = {
            str(row["hotel_id"])
            for row in rows
            if all(field_value(row, item["field"]) is not None for item in filters)
        }
        matched = [
            row
            for row in rows
            if all(
                compare(field_value(row, item["field"]), item["op"], item.get("value"))
                for item in filters
            )
        ]
        textual = dataset == "events" or any(isinstance(item.get("value"), str) for item in filters)
        if textual:
            matched = await self._evidence.verify(term, matched, filters) if self._evidence else []
            coverage = {str(row["hotel_id"]) for row in matched}
        self.remember_identity(matched)
        counts = Counter(str(row["hotel_id"]) for row in matched)
        self._reads += 1
        field = f"{'event' if dataset == 'events' else 'r'}{self._reads}.match_count"
        for hotel_id in coverage:
            self._metrics.setdefault(hotel_id, {})[field] = float(counts[hotel_id])
            quotes = tuple(
                str(row["_evidence_quote"])
                for row in matched
                if row["hotel_id"] == hotel_id and row.get("_evidence_quote")
            )
            self.source_urls.setdefault(hotel_id, {})[field] = tuple(
                str(row["source_url"])
                for row in matched
                if row["hotel_id"] == hotel_id and row.get("source_url")
            )
            if quotes:
                self.quotes.setdefault(hotel_id, {})[field] = quotes
            self.geo_refs.setdefault(hotel_id, {})[field] = tuple(
                str(row["geo_ref"])
                for row in matched
                if row["hotel_id"] == hotel_id and row.get("geo_ref")
            )
        if textual and term:
            self.verified_terms[field] = term
        self.field_context[field] = json.dumps(
            {"dataset": dataset, "filters": filters}, ensure_ascii=False
        )
        self._descriptions[field] = (
            "Проверенных событий: "
            + "; ".join(
                dict.fromkeys(
                    f"{r.get('title')} — {r.get('place')}, {r.get('start')}" for r in matched
                )
            )[:1200]
            if dataset == "events"
            else "Объектов внутри здания отеля"
            if dataset == "onsite_objects"
            else "Подтверждений в данных источника"
        )
        return {
            "dataset": dataset,
            "field": field,
            "hotels_with_data": len(coverage),
            "matched_record_count": len(matched),
            "samples": preview(matched[:8]),
            "note": "Only source-supported textual wishes get metrics; unsupported is unknown",
        }
