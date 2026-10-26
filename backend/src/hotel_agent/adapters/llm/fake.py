import json
import re
from collections.abc import Mapping, Sequence

from hotel_agent.adapters.llm.extraction import extract
from hotel_agent.adapters.llm.text import normalize, terms_outside
from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.ports.llm import Extraction, QuestionDraft, ToolCall
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.domain.characteristics import Characteristic, Matcher
from hotel_agent.domain.query import Intent, ParsedQuery

PLACES = (
    (re.compile(r"\bсочи\b|\bsochi\b"), "Сочи"),
    (re.compile(r"\bмоскв[аеуы]\b|\bmoscow\b"), "Москва"),
    (
        re.compile(
            r"\b(?:санкт[- ]?)?петербург[аеу]?\b|\bпитер[аеу]?\b|\b(?:saint |st\.? )?petersburg\b"
        ),
        "Санкт-Петербург",
    ),
)


def _place(text: str) -> tuple[str, int, int] | None:
    found = [
        (match.start(), match.end(), name)
        for pattern, name in PLACES
        for match in [pattern.search(text)]
        if match is not None
    ]
    if not found:
        return None
    start, end, name = min(found)
    return name, start, end


class FakeLLM:
    provider = "fake"

    def __init__(self, registry: CharacteristicRegistryPort) -> None:
        self._registry = registry

    async def explore_data(self, context: str) -> DataStep:
        payload = json.loads(context)
        term = payload.get("current_wish") or payload.get("terms", [""])[0]
        observed = payload.get("observations", [])
        if not any(item.get("tool") == "match_records" for item in observed):
            return DataStep(action="match_records", arguments={"dataset": "hotels", "term": term})
        if payload.get("pending_pages"):
            dataset, offset = next(iter(payload["pending_pages"].items()))
            return DataStep(
                action="match_records",
                arguments={"dataset": dataset, "offset": offset, "term": term},
            )
        return DataStep(
            action="finish",
            arguments={},
            reason="Доступный автономный режим не нашёл подтверждения пожелания в источниках.",
            irrelevant_sources=tuple(
                key for key in payload.get("available_sources", {}) if key != "database"
            ),
        )

    async def contextualize_query(
        self,
        previous: str | None,
        message: str,
        history: Sequence[tuple[str, str]] = (),
    ) -> str:
        return f"{previous}; {message}" if previous else message

    async def parse_query(self, query: str) -> ParsedQuery:
        text = normalize(query)
        spans: list[tuple[int, int]] = []
        found: list[tuple[int, Intent]] = []
        for characteristic in self._registry.all():
            best = _best_matcher(characteristic, text)
            if best is None:
                continue
            matcher, at = best
            spans.append((at, at + len(matcher.phrase)))
            found.append((at, _intent(characteristic, matcher)))
        place = _place(text)
        if place is not None:
            spans.append((place[1], place[2]))
        found.sort(key=lambda item: item[0])
        return ParsedQuery(
            intents=tuple(intent for _, intent in found),
            unmatched_terms=terms_outside(text, spans),
            location_hint=place[0] if place is not None else None,
            normalized_query=text,
        )

    async def plan_tools(
        self,
        query: ParsedQuery,
        subjects: Sequence[str],
        known: Mapping[str, Sequence[str]],
    ) -> Sequence[ToolCall]:
        calls = []
        for intent in query.intents:
            characteristic = self._registry.get(intent.characteristic_key)
            if characteristic.tool is None:
                continue
            for subject in subjects:
                if characteristic.key in known.get(subject, ()):
                    continue
                calls.append(ToolCall(characteristic_key=characteristic.key, subject=subject))
        return calls

    async def formulate_question(
        self, characteristic_key: str, reason: str, hotel_name: str
    ) -> QuestionDraft:
        characteristic = self._registry.get(characteristic_key)
        template = (
            characteristic.question_template or f"Уточните, пожалуйста: {characteristic.title_ru}"
        )
        return QuestionDraft(
            characteristic_key=characteristic_key,
            text=template.replace("{hotel}", hotel_name),
        )

    async def extract_fields(self, characteristic_key: str, answer: str) -> Extraction:
        characteristic = self._registry.get(characteristic_key)
        return Extraction(
            characteristic_key=characteristic_key, fields=extract(characteristic, answer)
        )

    async def aclose(self) -> None:
        return None

    async def verify_evidence(self, context: str) -> Sequence[EvidenceVerdict]:
        return ()


def _best_matcher(characteristic: Characteristic, text: str) -> tuple[Matcher, int] | None:
    hits = [(matcher, text.find(matcher.phrase)) for matcher in characteristic.matchers]
    present = [(matcher, at) for matcher, at in hits if at != -1]
    if not present:
        return None
    return max(present, key=lambda item: len(item[0].phrase))


def _intent(characteristic: Characteristic, matcher: Matcher) -> Intent:
    return Intent(
        characteristic_key=characteristic.key,
        op=matcher.op,
        value=matcher.value,
        weight=matcher.weight,
        required=matcher.required,
        source_text=matcher.phrase,
    )
