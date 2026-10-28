from dataclasses import dataclass
from enum import StrEnum


class ChatMode(StrEnum):
    SEARCH = "search"
    CONSULT = "consult"
    HOTEL = "hotel"


@dataclass(frozen=True, slots=True)
class ChatDecision:
    mode: ChatMode
    query: str | None = None
    reply: str | None = None
    question_keys: tuple[str, ...] = ()
