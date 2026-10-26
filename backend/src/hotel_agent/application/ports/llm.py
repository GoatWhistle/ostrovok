from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Protocol

from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.application.ports.chat_dialogue import ChatDecision
from hotel_agent.application.ports.text_evidence import EvidenceVerdict
from hotel_agent.domain.characteristics import ScalarValue
from hotel_agent.domain.query import ParsedQuery


@dataclass(frozen=True, slots=True, kw_only=True)
class ToolCall:
    characteristic_key: str
    subject: str


@dataclass(frozen=True, slots=True, kw_only=True)
class QuestionDraft:
    characteristic_key: str
    text: str


@dataclass(frozen=True, slots=True, kw_only=True)
class ExtractedField:
    name: str
    value: ScalarValue
    quote: str


@dataclass(frozen=True, slots=True, kw_only=True)
class Extraction:
    characteristic_key: str
    fields: tuple[ExtractedField, ...]


class LLMPort(Protocol):
    @property
    def provider(self) -> str: ...

    async def respond_to_chat(self, context: str) -> ChatDecision: ...

    async def parse_query(self, query: str) -> ParsedQuery: ...

    async def explore_data(self, context: str) -> DataStep: ...
    async def verify_evidence(self, context: str) -> Sequence[EvidenceVerdict]: ...

    async def contextualize_query(
        self,
        previous: str | None,
        message: str,
        history: Sequence[tuple[str, str]] = (),
    ) -> str: ...

    async def plan_tools(
        self,
        query: ParsedQuery,
        subjects: Sequence[str],
        known: Mapping[str, Sequence[str]],
    ) -> Sequence[ToolCall]: ...

    async def formulate_question(
        self, characteristic_key: str, reason: str, hotel_name: str
    ) -> QuestionDraft: ...

    async def extract_fields(self, characteristic_key: str, answer: str) -> Extraction: ...

    async def aclose(self) -> None: ...
