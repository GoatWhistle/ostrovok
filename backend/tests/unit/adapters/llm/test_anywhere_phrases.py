from hotel_agent.adapters.llm.query_payload import parse_payload
from hotel_agent.application.anywhere_request import says_anywhere


def test_the_city_chip_phrase_always_means_anywhere() -> None:
    assert says_anywhere("Город не важен, ищите по всей России")
    assert says_anywhere("The city does not matter, search across Russia")


def test_the_phrase_counts_inside_a_longer_request() -> None:
    assert says_anywhere("Хочу отель с видом на горы, город не важен")
    assert says_anywhere("Отель с номерами как в средние века, город не важен")


def test_other_anywhere_wordings_count() -> None:
    assert says_anywhere("Найди отель где угодно в России")
    assert says_anywhere("Любой город, лишь бы было тихо")


def test_a_named_city_is_not_anywhere() -> None:
    assert not says_anywhere("Отель в Сочи у моря")
    assert not says_anywhere("Важен вид на море в Казани")


def test_an_anywhere_request_does_not_ask_for_a_city() -> None:
    parsed = parse_payload(
        {
            "wishes": [],
            "intents": [],
            "unmatched_terms": [],
            "location_hint": None,
            "anywhere": False,
            "needs_clarification": True,
        },
        "Город не важен, ищите по всей России. Хочу отель с видом на горы",
        lambda raw, query: None,
    )

    assert parsed.anywhere
    assert not parsed.needs_clarification
