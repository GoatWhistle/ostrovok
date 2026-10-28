from dataclasses import replace
from datetime import date

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.reply_plurals import hotels_ru
from hotel_agent.application.search_reply import fallback_reply, search_reply
from hotel_agent.application.stay_question import guests_given
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
    assert "Все условия пока не подтверждены ни у одного" in answer


def test_guest_count_from_capacity_intent_is_not_asked_again() -> None:
    search = SearchOutcome(
        query_id="q", parsed=room_query(), results=(hotel("Alfa", MatchQuality.FULL),)
    )

    answer = search_reply(search, None, "ru")

    assert "сколько вас" not in answer
    assert answer.endswith("На какие даты едете?")


def test_single_missing_date_is_named_precisely() -> None:
    parsed = replace(room_query(), check_in=date(2026, 11, 1), budget="5000")
    search = SearchOutcome(query_id="q", parsed=parsed, results=(hotel("A", MatchQuality.FULL),))

    answer = search_reply(search, None, "en")

    assert answer.endswith("Until what date are you staying?")


def test_found_reply_names_top_hotels_with_russian_plural() -> None:
    parsed = ParsedQuery(intents=(QUIET,), unmatched_terms=(), location_hint="Сочи")
    results = tuple(hotel(name, MatchQuality.FULL) for name in ("A", "B", "C", "D"))
    search = SearchOutcome(query_id="q", parsed=parsed, results=results)

    assert search_reply(search, None, "ru") == "Нашёл 4 отеля. Ближе всего к запросу: A, B и C."
    assert (
        search_reply(search, None, "en") == "Found 4 hotels. Closest to your request: A, B and C."
    )


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


def test_review_fallback_uses_plurals_and_ends_with_one_date_question() -> None:
    parsed = ParsedQuery(intents=(QUIET,), unmatched_terms=(), location_hint="Хоста")
    parsed = replace(parsed, normalized_query="тихий отель в Хосте у моря на двоих")
    expected = {
        1: ("Нашёл 1 отель.", "Found 1 hotel."),
        2: ("Нашёл 2 отеля.", "Found 2 hotels."),
        5: ("Нашёл 5 отелей.", "Found 5 hotels."),
        21: ("Нашёл 21 отель.", "Found 21 hotels."),
    }
    for count, (ru, en) in expected.items():
        results = tuple(hotel(f"H{index}", MatchQuality.UNKNOWN) for index in range(count))
        search = SearchOutcome(query_id="q", parsed=parsed, results=results)

        answer_ru = fallback_reply(search, "ru")
        answer_en = fallback_reply(search, "en")

        assert answer_ru == (
            f"{ru} Все условия пока не подтверждены ни у одного, поэтому показываю"
            " самые близкие, детали в карточках. На какие даты едете?"
        )
        assert answer_en == (
            f"{en} None has every condition verified yet, so these are the closest;"
            " details are on the cards. What dates are you travelling?"
        )


def test_known_dates_and_guests_move_the_question_to_budget() -> None:
    parsed = replace(
        room_query(), check_in=date(2026, 11, 1), check_out=date(2026, 11, 3), intents=(QUIET,)
    )
    parsed = replace(parsed, normalized_query="номер вдвоём")
    search = SearchOutcome(query_id="q", parsed=parsed, results=(hotel("A", MatchQuality.FULL),))

    assert search_reply(search, None, "ru").endswith("Какой бюджет на ночь?")


def test_unknown_guests_are_asked_after_dates() -> None:
    parsed = ParsedQuery(
        intents=(QUIET,),
        unmatched_terms=(),
        location_hint="Сочи",
        wants_room=True,
        check_in=date(2026, 11, 1),
        check_out=date(2026, 11, 3),
    )
    search = SearchOutcome(query_id="q", parsed=parsed, results=(hotel("A", MatchQuality.FULL),))

    assert search_reply(search, None, "en").endswith("How many of you are travelling?")


def test_hotel_words_are_not_read_as_guest_counts() -> None:
    plain = ParsedQuery(intents=(), unmatched_terms=(), location_hint="Сочи")
    for text in ("гостиница у моря", "guest house near the sea"):
        assert not guests_given(replace(plain, normalized_query=text))
    for text in ("номер на двоих", "вдвоём", "2 взрослых", "for two", "2 adults"):
        assert guests_given(replace(plain, normalized_query=text))
