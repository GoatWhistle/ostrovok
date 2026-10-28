from collections.abc import Sequence
from dataclasses import dataclass

from hotel_agent.application.dto import FeedCursor, NotificationCounters
from hotel_agent.application.feed_cursor import decode_cursor
from hotel_agent.application.notification_records import notification_from_record
from hotel_agent.application.ports.clock import ClockPort
from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.application.ports.repositories import UnitOfWork, UnitOfWorkFactory
from hotel_agent.domain.errors import HotelNotFound, InvalidQuery
from hotel_agent.domain.notifications import Notification

MAX_PAGE = 100
DEFAULT_PAGE = 50


@dataclass(frozen=True, slots=True, kw_only=True)
class FeedItem:
    notification: Notification
    title: str | None = None
    question_text: str | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class NotificationFeed:
    items: tuple[FeedItem, ...] = ()
    next_cursor: FeedCursor | None = None
    unread: NotificationCounters


class ListHotelierNotifications:
    def __init__(self, uow: UnitOfWorkFactory, registry: CharacteristicRegistryPort) -> None:
        self._uow, self._registry = uow, registry

    async def __call__(
        self,
        hotel_id: str,
        unread_only: bool = False,
        cursor: str | None = None,
        limit: int = DEFAULT_PAGE,
    ) -> NotificationFeed:
        if limit < 1 or limit > MAX_PAGE:
            raise InvalidQuery(f"Page size must be between 1 and {MAX_PAGE}")
        async with self._uow() as uow:
            await _known_hotel(uow, hotel_id)
            page = await uow.notifications.page(
                hotel_id,
                unread_only=unread_only,
                cursor=decode_cursor(cursor),
                limit=limit,
            )
            unread = await uow.notifications.unread_counts(hotel_id)
            questions = {
                record.id: record.text for record in await uow.questions.for_hotel(hotel_id)
            }
        titles = {item.key: item.title_ru for item in self._registry.all()}
        return NotificationFeed(
            items=tuple(
                self._item(notification_from_record(record), titles, questions)
                for record in page.items
            ),
            next_cursor=page.next_cursor,
            unread=unread,
        )

    @staticmethod
    def _item(
        item: Notification,
        titles: dict[str, str],
        questions: dict[str, str],
    ) -> FeedItem:
        return FeedItem(
            notification=item,
            title=titles.get(item.characteristic_key or ""),
            question_text=questions.get(str(item.question_id)) if item.question_id else None,
        )


class MarkNotificationsRead:
    def __init__(self, uow: UnitOfWorkFactory, clock: ClockPort) -> None:
        self._uow, self._clock = uow, clock

    async def __call__(self, hotel_id: str, ids: Sequence[str] | None = None) -> int:
        now = self._clock.now()
        async with self._uow() as uow:
            await _known_hotel(uow, hotel_id)
            changed = (
                await uow.notifications.mark_all_read(hotel_id, now)
                if not ids
                else await uow.notifications.mark_read(hotel_id, ids, now)
            )
            await uow.commit()
        return changed


async def _known_hotel(uow: UnitOfWork, hotel_id: str) -> None:
    if await uow.search.get_hotel(hotel_id) is None:
        raise HotelNotFound()
