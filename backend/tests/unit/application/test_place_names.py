from hotel_agent.application.place_names import localized_place
from hotel_agent.interfaces.http.routers.chat import localized_fields


def test_russian_places_get_english_names_for_english_locale() -> None:
    assert localized_place("Адлер", "en") == "Adler"
    assert localized_place("Хоста", "en") == "Khosta"
    assert localized_place("Москва", "en") == "Moscow"
    assert localized_place("Красная Поляна", "en") == "Krasnaya Polyana"
    assert localized_place("Адлер", "ru") == "Адлер"


def test_progress_location_is_localized_and_other_fields_stay() -> None:
    fields: dict[str, object] = {"location": "Сочи", "intents": []}

    assert localized_fields(fields, "en") == {"location": "Sochi", "intents": []}
    assert localized_fields(fields, "ru") == fields
    assert localized_fields({"found": 3}, "en") == {"found": 3}
