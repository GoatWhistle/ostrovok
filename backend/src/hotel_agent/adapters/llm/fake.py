from collections.abc import Mapping, Sequence

from hotel_agent.adapters.llm.extraction import extract
from hotel_agent.adapters.llm.text import normalize, terms_outside
from hotel_agent.application.ports.llm import Extraction, QuestionDraft, ToolCall
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.domain.characteristics import Characteristic, Matcher
from hotel_agent.domain.query import Intent, ParsedQuery


class FakeLLM:
    provider = "fake"

    def __init__(self, registry: CharacteristicRegistryPort) -> None:
        self._registry = registry

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
        found.sort(key=lambda item: item[0])
        return ParsedQuery(
            intents=tuple(intent for _, intent in found),
            unmatched_terms=terms_outside(text, spans),
            location_hint=None,
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
