from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from hotel_agent.application.dto import NotificationCounters
from hotel_agent.application.feed_cursor import encode_cursor
from hotel_agent.application.use_cases.answer_questions import BatchAnswerResult
from hotel_agent.application.use_cases.hotelier_cabinet import (
    CabinetOverview,
    CharacteristicState,
    QueuedQuestion,
)
from hotel_agent.application.use_cases.hotelier_notifications import FeedItem, NotificationFeed
from hotel_agent.domain.services.hotelier_attention import Attention
from hotel_agent.domain.services.hotelier_coverage import Coverage
from hotel_agent.interfaces.http.fact_schemas import (
    ConflictSchema,
    FactSchema,
    conflict_schema,
    fact_schema,
)
from hotel_agent.interfaces.http.hotel_identity_schemas import (
    HotelSummarySchema,
    hotel_summary_schema,
)
from hotel_agent.interfaces.http.hotelier_schemas import QuestionSchema, question_schema

NotificationKindName = Literal[
    "question_opened",
    "answer_accepted",
    "answer_needs_detail",
    "fact_changed",
    "fact_expiring",
    "conflict_opened",
    "conflict_resolved",
    "search_demand",
]


class NotificationCountersSchema(BaseModel):
    total: int
    action: int
    by_kind: dict[str, int] = Field(default_factory=dict)


class HotelierNotificationSchema(BaseModel):
    id: str
    hotel_id: str
    kind: NotificationKindName
    severity: Literal["action", "info"]
    created_at: datetime
    read_at: datetime | None = None
    characteristic_key: str | None = None
    title: str | None = None
    question_id: str | None = None
    question_text: str | None = None
    fact_id: str | None = None
    conflict_id: str | None = None
    payload: dict[str, object] = Field(default_factory=dict)


class HotelierNotificationFeedSchema(BaseModel):
    items: list[HotelierNotificationSchema]
    next_cursor: str | None = None
    unread: NotificationCountersSchema


class ReadNotificationsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ids: list[str] = Field(default_factory=list, max_length=200)


class ReadNotificationsSchema(BaseModel):
    read: int
    unread: NotificationCountersSchema


class CoverageSummarySchema(BaseModel):
    total: int
    known: int
    unknown: int
    confirmed: int
    stale: int
    disputed: int
    completeness: float


class CharacteristicStateSchema(BaseModel):
    key: str
    title: str
    state: Literal["known", "confirmed", "stale", "disputed", "unknown"]
    askable: bool
    blocked_searches: int
    appearances: int
    fact: FactSchema | None = None


class QueuedQuestionSchema(BaseModel):
    question: QuestionSchema
    blocked_searches: int
    priority: float


class HotelierAttentionSchema(BaseModel):
    kind: Literal["resolve_conflict", "answer_question", "reconfirm_value"]
    reference: str
    characteristic_key: str
    blocked_searches: int


class HotelierOverviewSchema(BaseModel):
    hotel: HotelSummarySchema
    coverage: CoverageSummarySchema
    unread: NotificationCountersSchema
    appearances: int
    window_days: int
    questions: list[QueuedQuestionSchema]
    conflicts: list[ConflictSchema]
    expiring: list[FactSchema]
    characteristics: list[CharacteristicStateSchema]
    next_action: HotelierAttentionSchema | None = None


class AppliedAnswerSchema(BaseModel):
    question_id: str
    extracted: list[FactSchema]
    conflicts: list[ConflictSchema]


class BatchAnswerSchema(BaseModel):
    hotel_id: str
    applied: list[AppliedAnswerSchema]
    untouched: list[str]


def counters_schema(counters: NotificationCounters) -> NotificationCountersSchema:
    return NotificationCountersSchema(
        total=counters.total, action=counters.action, by_kind=dict(counters.by_kind)
    )


def notification_schema(item: FeedItem) -> HotelierNotificationSchema:
    notification = item.notification
    return HotelierNotificationSchema(
        id=str(notification.id),
        hotel_id=str(notification.hotel_id),
        kind=notification.kind.value,
        severity=notification.severity.value,
        created_at=notification.created_at,
        read_at=notification.read_at,
        characteristic_key=notification.characteristic_key,
        title=item.title,
        question_id=str(notification.question_id) if notification.question_id else None,
        question_text=item.question_text,
        fact_id=str(notification.fact_id) if notification.fact_id else None,
        conflict_id=str(notification.conflict_id) if notification.conflict_id else None,
        payload=dict(notification.payload),
    )


def feed_schema(feed: NotificationFeed) -> HotelierNotificationFeedSchema:
    return HotelierNotificationFeedSchema(
        items=[notification_schema(item) for item in feed.items],
        next_cursor=encode_cursor(feed.next_cursor) if feed.next_cursor else None,
        unread=counters_schema(feed.unread),
    )


def coverage_schema(summary: Coverage) -> CoverageSummarySchema:
    return CoverageSummarySchema(
        total=summary.total,
        known=summary.known,
        unknown=summary.unknown,
        confirmed=summary.confirmed,
        stale=summary.stale,
        disputed=summary.disputed,
        completeness=round(summary.completeness, 4),
    )


def state_schema(state: CharacteristicState) -> CharacteristicStateSchema:
    return CharacteristicStateSchema(
        key=state.key,
        title=state.title,
        state=state.state,
        askable=state.askable,
        blocked_searches=state.blocked_searches,
        appearances=state.appearances,
        fact=fact_schema(state.fact) if state.fact is not None else None,
    )


def queued_schema(item: QueuedQuestion) -> QueuedQuestionSchema:
    return QueuedQuestionSchema(
        question=question_schema(item.question),
        blocked_searches=item.blocked_searches,
        priority=round(item.priority, 3),
    )


def attention_schema(item: Attention) -> HotelierAttentionSchema:
    return HotelierAttentionSchema(
        kind=item.kind.value,
        reference=item.reference,
        characteristic_key=item.characteristic_key,
        blocked_searches=item.blocked_searches,
    )


def overview_schema(overview: CabinetOverview) -> HotelierOverviewSchema:
    return HotelierOverviewSchema(
        hotel=hotel_summary_schema(overview.hotel),
        coverage=coverage_schema(overview.coverage),
        unread=counters_schema(overview.unread),
        appearances=overview.appearances,
        window_days=overview.window_days,
        questions=[queued_schema(item) for item in overview.questions],
        conflicts=[conflict_schema(item) for item in overview.conflicts],
        expiring=[fact_schema(item) for item in overview.expiring],
        characteristics=[state_schema(item) for item in overview.characteristics],
        next_action=(
            attention_schema(overview.next_action) if overview.next_action is not None else None
        ),
    )


def batch_answer_schema(result: BatchAnswerResult) -> BatchAnswerSchema:
    return BatchAnswerSchema(
        hotel_id=result.hotel_id,
        applied=[
            AppliedAnswerSchema(
                question_id=item.question_id,
                extracted=[fact_schema(fact) for fact in item.extracted],
                conflicts=[conflict_schema(conflict) for conflict in item.conflicts],
            )
            for item in result.applied
        ],
        untouched=list(result.untouched),
    )
