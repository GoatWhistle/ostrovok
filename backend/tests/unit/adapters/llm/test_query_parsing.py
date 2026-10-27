from hotel_agent.adapters.db.nearby_objects import name_patterns
from hotel_agent.adapters.llm.query_payload import quoted_name


def test_named_chain_survives_russian_declension_but_invented_name_does_not() -> None:
    assert quoted_name("шаверма", "хочу отель в Петербурге рядом с шавермой")
    assert quoted_name("Додо Пицца", "отель рядом с Додо Пиццей")
    assert not quoted_name("Бургер Кинг", "отель рядом с кафе")
    assert not quoted_name("", "отель рядом с кафе")


def test_name_patterns_match_each_word_by_stem() -> None:
    assert name_patterns("ВкусВилл") == ["(^|[^[:alnum:]])вкусв"]
    assert name_patterns("Лосиной фермы") == ["(^|[^[:alnum:]])лоси", "(^|[^[:alnum:]])ферм"]
    assert name_patterns(" ") is None
