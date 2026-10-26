from datetime import UTC, datetime
from typing import Any, ClassVar, cast

from hotel_agent.application.agent.wish_context import wish_context
from hotel_agent.application.agent.wish_ledger import WishLedger

NOW = datetime(2026, 10, 27, tzinfo=UTC)


class Tools:
    city = "Москва"
    hotels: ClassVar[tuple[Any, ...]] = ()
    bbox = None
    allow_expand = False
    discovery_allowed = False
    sources: ClassVar[dict[str, bool]] = {"web": True}


def observation(index: int, text: str) -> dict[str, Any]:
    return {"tool": "read_web_page", "arguments": {"url": f"u{index}"}, "result": {"text": text}}


def test_only_the_latest_observations_keep_full_page_text() -> None:
    page = "А" * 9000
    observations = [observation(index, page) for index in range(4)]

    context = wish_context(
        "запрос", "пожелание", cast(Any, Tools()), WishLedger({}), observations, 10, NOW
    )

    assert context.count(page) == 2
    assert "обрезано" in context
    assert len(context) < 4 * len(page)
