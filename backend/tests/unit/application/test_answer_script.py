from hotel_agent.application.agent.chat_answer_review import foreign_script


def test_chinese_leaking_into_a_russian_answer_is_rejected() -> None:
    assert foreign_script("Вы хотите度假酒店 с конкретным видом на горы")


def test_a_plain_russian_answer_passes() -> None:
    assert not foreign_script("В подборке 20 отелей. Условия отмечены в карточках.")


def test_a_plain_english_answer_passes() -> None:
    assert not foreign_script("Showing 20 hotels. The cards mark verified conditions.")


def test_a_latin_hotel_name_inside_russian_passes() -> None:
    assert not foreign_script("Первые в подборке: Portofino, Prichal, Арфа Парк Отель.")


def test_japanese_and_korean_are_rejected_too() -> None:
    assert foreign_script("Отель ホテル в Сочи")
    assert foreign_script("Отель 호텔 в Сочи")
