from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True, slots=True, kw_only=True)
class ChatMessageRecord:
    id: str
    role: str
    content: str
    created_at: datetime


@dataclass(frozen=True, slots=True, kw_only=True)
class ConversationRecord:
    id: str
    region_id: str
    effective_query: str | None
    messages: tuple[ChatMessageRecord, ...]
