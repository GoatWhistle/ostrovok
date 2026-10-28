from dataclasses import replace
from datetime import date

from hotel_agent.application.chat_filters import filters_of, filters_of_snapshot, query_of
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.filters import SearchFilter
from hotel_agent.domain.query import Intent
from tests.unit.application.test_chat_conversations import PARSED, SUNSET, build

BARS = Intent(
    characteristic_key="bars_nearby",
    op=Op.EQ,
    value=True,
    weight=1.0,
    required=False,
    source_text="бары рядом",
)
STAY = replace(
    PARSED,
    intents=(SUNSET, BARS, replace(BARS, source_text="Бары рядом")),
    check_in=date(2026, 11, 12),
    check_out=date(2026, 11, 14),
    adults=2,
)


def test_parsed_query_becomes_stay_and_wish_filters_without_repeats() -> None:
    found = filters_of(STAY)

    assert [(item.kind, item.label or item.adults or item.check_in) for item in found] == [
        ("location", "Сочи"),
        ("dates", date(2026, 11, 12)),
        ("guests", 2),
        ("wish", "с видом на закат"),
        ("wish", "бары рядом"),
    ]
    assert found[3].key == "sunset_view"


def test_snapshot_rebuilds_the_same_filters_as_the_parsed_query() -> None:
    snapshot = {
        "parsed": {
            "location_hint": "Сочи",
            "check_in": "2026-11-12",
            "check_out": "2026-11-14",
            "adults": 2,
            "intents": [
                {"characteristic_key": "sunset_view", "source_text": "с видом на закат"},
                {"characteristic_key": "bars_nearby", "source_text": "бары рядом"},
            ],
        }
    }

    assert filters_of_snapshot(snapshot) == filters_of(STAY)
    assert filters_of_snapshot(None) == ()
    assert filters_of_snapshot({"parsed": None}) == ()


def test_query_keeps_every_filter_and_drops_the_city_requirement_without_a_location() -> None:
    filters = filters_of(STAY)

    assert query_of(filters) == (
        "Сочи; заезд 2026-11-12, выезд 2026-11-14; взрослых: 2; с видом на закат; бары рядом"
    )
    assert query_of([item for item in filters if item.kind != "location"]) == (
        "заезд 2026-11-12, выезд 2026-11-14; взрослых: 2; с видом на закат; "
        "бары рядом; город не важен"
    )
    assert query_of(()) == ""
    assert query_of([SearchFilter(kind="dates", check_in=date(2026, 11, 12))]) == (
        "заезд 2026-11-12; город не важен"
    )


async def test_active_filters_replace_the_remembered_conditions_of_the_next_message() -> None:
    harness = build(STAY)
    created = await harness.chat.send(None, "закат и бары в Сочи", "russia", None)
    kept = [item for item in created.filters if item.label != "бары рядом"]

    followed = await harness.chat.send(
        created.conversation.id, "ещё тише", "russia", None, filters=kept
    )

    assert "бары рядом" not in (followed.conversation.effective_query or "")
    assert followed.conversation.effective_query == (
        "Сочи; заезд 2026-11-12, выезд 2026-11-14; взрослых: 2; с видом на закат ещё тише"
    )


async def test_removing_a_filter_without_a_message_searches_and_adds_no_user_reply() -> None:
    harness = build(STAY)
    created = await harness.chat.send(None, "закат и бары в Сочи", "russia", None)
    kept = [item for item in created.filters if item.label != "с видом на закат"]

    edited = await harness.chat.send(created.conversation.id, "", "russia", None, filters=kept)

    assert edited.conversation.effective_query == (
        "Сочи; заезд 2026-11-12, выезд 2026-11-14; взрослых: 2; бары рядом"
    )
    assert [item.role for item in edited.conversation.messages] == [
        "user",
        "assistant",
        "assistant",
    ]
    assert edited.filters == filters_of(STAY)


async def test_filters_alone_start_a_conversation_and_an_empty_request_is_rejected() -> None:
    harness = build(PARSED)

    started = await harness.chat.send(
        None, "", "russia", None, filters=[SearchFilter(kind="wish", label="с видом на закат")]
    )

    assert started.conversation.effective_query == "с видом на закат; город не важен"
    assert started.conversation.title == "Сочи: с видом на закат"
    assert [item.role for item in started.conversation.messages] == ["assistant"]


async def test_conversation_without_filters_keeps_the_remembered_query() -> None:
    harness = build(PARSED)
    created = await harness.chat.send(None, "закат в Сочи", "russia", None)

    followed = await harness.chat.send(created.conversation.id, "ещё тише", "russia", None)

    assert followed.conversation.effective_query == "закат в Сочи ещё тише"
    assert [item.kind for item in followed.filters] == ["location", "wish"]
