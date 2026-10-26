from collections import Counter
from collections.abc import Awaitable, Callable, Sequence
from typing import Any

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
        self.quotes: dict[str, dict[str, tuple[str, ...]]] = {}
        self.source_urls: dict[str, dict[str, tuple[str, ...]]] = {}
        self.geo_refs: dict[str, dict[str, tuple[str, ...]]] = {}

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
        textual = any(isinstance(item.get("value"), str) for item in filters)
        if textual:
            matched = await self._evidence.verify(term, matched, filters) if self._evidence else []
            coverage = {str(row["hotel_id"]) for row in matched}
        counts = Counter(str(row["hotel_id"]) for row in matched)
        self._reads += 1
        field = f"r{self._reads}.match_count"
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
        self._descriptions[field] = (
            "Объектов внутри здания отеля"
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
