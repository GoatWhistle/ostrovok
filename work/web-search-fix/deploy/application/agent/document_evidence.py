import json
from collections.abc import Sequence
from typing import Any

from hotel_agent.application.ports.llm import LLMPort


class DocumentEvidence:
    def __init__(self, llm: LLMPort, terms: tuple[str, ...], query: str = "") -> None:
        self._llm, self._terms, self._query = llm, terms, query

    async def verify(
        self, term: str | None, rows: Sequence[dict[str, Any]], filters: Sequence[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        term = term or (self._terms[0] if len(self._terms) == 1 else None)
        if term not in self._terms:
            raise ValueError(f"Supply term from the requested wishes: {self._terms}")
        sources = {}
        selected = rows[:12]
        budget = min(40000, 48000 // max(len(selected), 1))
        for index, row in enumerate(selected):
            text = row.get("text") or json.dumps(row, ensure_ascii=False)
            text = str(text)
            values = [
                str(item.get("value", ""))
                for item in filters
                if item.get("field") not in {"source_url", "hotel_id", "record_kind"}
            ]
            start = min(
                (
                    text.casefold().find(value.casefold())
                    for value in values
                    if value and value.casefold() in text.casefold()
                ),
                default=0,
            )
            snippet = text[max(start - 400, 0) : max(start - 400, 0) + budget]
            sources[str(index)] = (row, snippet)
        if not sources:
            return []
        context = json.dumps(
            {
                "wish": term,
                "request": self._query,
                "records": [
                    {
                        "record_id": key,
                        "source_text": text,
                        **{
                            field: row[field]
                            for field in (
                                "hotel_name",
                                "hotel_address",
                                "hotel_location",
                                "hotel_identity",
                                "source_url",
                            )
                            if field in row
                        },
                    }
                    for key, (row, text) in sources.items()
                ],
            },
            ensure_ascii=False,
        )
        verdicts = await self._llm.verify_evidence(context)
        verified = []
        seen = set()
        for verdict in verdicts:
            if verdict.record_id not in sources or verdict.record_id in seen:
                continue
            row, text = sources[verdict.record_id]
            if (
                not verdict.supported
                or len(verdict.quote.strip()) < 12
                or verdict.quote not in text
            ):
                continue
            seen.add(verdict.record_id)
            verified.append(dict(row, _evidence_quote=verdict.quote))
        return verified
