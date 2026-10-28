from dataclasses import replace
from datetime import date

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.reply_notes import hotels_ru
from hotel_agent.application.search_reply import search_reply
from hotel_agent.application.use_cases.search_hotels import SearchOutcome, SearchResult
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import MatchQuality, PropertyMatch, Scored

GUESTS = Intent(
    characteristic_key="room_capacity",
    op=Op.GTE,
    value=2.0,
    weight=1.0,
    required=True,
    source_text="на двоих",
)
QUIET = Intent(
    characteristic_key="quiet",
    op=Op.EQ,
    value=True,
    weight=1.0,
    required=True,
    source_text="тихий",
)


def hotel(name: str, quality: MatchQuality) -> SearchResult:
    record = SearchHotelRecord(
        id=f"id-{name}",
        region_id="sochi",
        name=name,
        location=(39.9, 43.4),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )
    matches = (PropertyMatch(intent=QUIET, fact=None, quality=quality),)
    return SearchResult(hotel=record, scored=Scored(score=0.5, matches=matches, disqualified=False))


def room_query() -> ParsedQuery:
    return ParsedQuery(
        intents=(QUIET, GUESTS), unmatched_terms=(), location_hint="Хоста", wants_room=True
    )


def test_model_question_is_the_only_question_and_comes_last() -> None:
    question = "На какие даты проживания вам нужны номера на двоих?"
    search = SearchOutcome(
        query_id="q",
        parsed=room_query(),
        results=(hotel("Alfa", MatchQuality.UNKNOWN),),
        question=question,
    )

    answer = search_reply(search, None, "ru")

    assert answer.endswith(question)
    assert answer.count("?") == 1
    assert "свободные номера" not in answer
    assert "Ни у одного отеля пока не подтверждены все условия" in answer


def test_guest_count_from_capacity_intent_is_not_asked_again() -> None:
    search = SearchOutcome(
        query_id="q", parsed=room_query(), results=(hotel("Alfa", MatchQuality.FULL),)
    )

    answer = search_reply(search, None, "ru")

    assert "сколько вас" not in answer
    assert "Напишите даты поездки и бюджет, и я проверю свободные номера." in answer


def test_single_missing_date_is_named_precisely() -> None:
    parsed = replace(room_query(), check_in=date(2026, 11, 1), budget="5000")
    search = SearchOutcome(query_id="q", parsed=parsed, results=(hotel("A", MatchQuality.FULL),))

    answer = search_reply(search, None, "en")

    assert answer.endswith("Tell me the check-out date, and I'll check free rooms.")


def test_found_reply_names_top_hotels_with_russian_plural() -> None:
    parsed = ParsedQuery(intents=(QUIET,), unmatched_terms=(), location_hint="Сочи")
    results = tuple(hotel(name, MatchQuality.FULL) for name in ("A", "B", "C", "D"))
    search = SearchOutcome(query_id="q", parsed=parsed, results=results)

    assert search_reply(search, None, "ru") == "Нашёл 4 отеля. Ближе всего к запросу: A, B и C."
    assert search_reply(search, None, "en") == "Found 4 hotels. Closest to your request: A, B and C."


def test_russian_hotel_plural_forms() -> None:
    assert [hotels_ru(n) for n in (1, 2, 5, 11, 21, 112)] == [
        "1 отель",
        "2 отеля",
        "5 отелей",
        "11 отелей",
        "21 отель",
        "112 отелей",
    ]


def test_selected_hotel_update_is_short() -> None:
    parsed = ParsedQuery(intents=(QUIET,), unmatched_terms=(), location_hint="Сочи")
    results = (hotel("Alfa", MatchQuality.FULL), hotel("Beta", MatchQuality.FULL))
    search = SearchOutcome(query_id="q", parsed=parsed, results=results)

    answer = search_reply(search, "id-Beta", "ru")

    assert answer == "Учёл. «Beta» остаётся в подборке, всего 2 отеля."
