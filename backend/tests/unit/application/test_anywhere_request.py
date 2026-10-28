from hotel_agent.application.anywhere_request import keep_anywhere, says_anywhere


def test_the_rewrite_keeps_an_explicit_refusal_to_name_a_city() -> None:
    kept = keep_anywhere(
        "Отель с номерами как в средние века, город не важен", "отель в средневековом стиле"
    )

    assert says_anywhere(kept)


def test_a_rewrite_that_already_says_it_is_left_alone() -> None:
    query = "отель с видом на горы, по всей России"

    assert keep_anywhere("Хочу по всей России", query) == query


def test_a_request_naming_a_city_is_untouched() -> None:
    assert keep_anywhere("Отель в Сочи у моря", "отель в Сочи у моря") == "отель в Сочи у моря"
