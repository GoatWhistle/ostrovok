from datetime import datetime

from hotel_agent.application.dto import FeedCursor
from hotel_agent.domain.errors import InvalidQuery

SEPARATOR = "~"


def encode_cursor(cursor: FeedCursor) -> str:
    return f"{cursor.created_at.isoformat()}{SEPARATOR}{cursor.id}"


def decode_cursor(raw: str | None) -> FeedCursor | None:
    if raw is None or not raw.strip():
        return None
    head, separator, identifier = raw.partition(SEPARATOR)
    if not separator or not identifier:
        raise InvalidQuery("Cursor is malformed")
    try:
        moment = datetime.fromisoformat(head)
    except ValueError as error:
        raise InvalidQuery("Cursor carries an unreadable timestamp") from error
    if moment.tzinfo is None:
        raise InvalidQuery("Cursor timestamp has no time zone")
    return FeedCursor(created_at=moment, id=identifier)
