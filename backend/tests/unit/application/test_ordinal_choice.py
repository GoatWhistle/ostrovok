from hotel_agent.application.ordinal_choice import chosen_hotel_id

SNAPSHOT = {
    "results": [
        {"hotel": {"id": "h1", "name": "Маринс Парк Отель"}},
        {"hotel": {"id": "h2", "name": "Пенаты"}},
        {"hotel": {"id": "h3", "name": "Парк Виста"}},
    ]
}


def test_show_the_first_one_picks_the_first_result() -> None:
    assert chosen_hotel_id("Покажи первый подробнее", SNAPSHOT) == "h1"


def test_a_question_about_the_second_picks_the_second() -> None:
    assert chosen_hotel_id("А второй далеко от вокзала?", SNAPSHOT) == "h2"


def test_the_last_one_picks_the_last_result() -> None:
    assert chosen_hotel_id("Расскажи про последний", SNAPSHOT) == "h3"


def test_english_ordinals_work_too() -> None:
    assert chosen_hotel_id("Show the first in more detail", SNAPSHOT) == "h1"


def test_an_ordinal_beyond_the_list_is_ignored() -> None:
    assert chosen_hotel_id("Покажи пятый", SNAPSHOT) is None


def test_a_message_without_an_ordinal_selects_nothing() -> None:
    assert chosen_hotel_id("А парковка точно есть?", SNAPSHOT) is None


def test_an_empty_selection_selects_nothing() -> None:
    assert chosen_hotel_id("Покажи первый", {"results": []}) is None
    assert chosen_hotel_id("Покажи первый", None) is None
