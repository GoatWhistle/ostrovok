from collections.abc import Sequence
from types import SimpleNamespace
from typing import cast

import pytest

from hotel_agent.application.conversation_titles import (
    conversation_title,
    shorten,
    validated_title,
)
from hotel_agent.domain.characteristics import Characteristic, Op
from hotel_agent.domain.errors import InvalidConversationTitle, UnknownCharacteristic
from hotel_agent.domain.query import FacilityRequest, Intent, ParsedQuery

TITLES = {
    "noise_level": "Шум со стороны фасада",
    "sunset_view": "Вид на закат",
    "distance_to_sea": "Пешком до моря",
    "pets_policy": "Размещение с животными",
}


class FakeRegistry:
    def all(self) -> Sequence[Characteristic]:
        return ()

    def get(self, key: str) -> Characteristic:
        if key not in TITLES:
            raise UnknownCharacteristic()
        return cast(Characteristic, SimpleNamespace(key=key, title_ru=TITLES[key]))


def intent(key: str, source_text: str) -> Intent:
    return Intent(
        characteristic_key=key,
        op=Op.EQ,
        value=True,
        weight=1.0,
        required=False,
        source_text=source_text,
    )


def parsed(*intents: Intent, location: str | None = "Сочи") -> ParsedQuery:
    return ParsedQuery(intents=intents, unmatched_terms=(), location_hint=location)


def test_title_joins_location_with_three_wishes_in_user_words() -> None:
    query = parsed(
        intent("noise_level", "тихий"),
        intent("sunset_view", "с видом на закат"),
        intent("distance_to_sea", "недалеко от моря"),
        intent("pets_policy", "с собакой"),
    )

    title = conversation_title(query, "тихий номер", "ru", FakeRegistry())

    assert title == "Сочи: тихий, с видом на закат, недалеко от моря"


def test_registry_label_is_used_when_wish_has_no_words() -> None:
    query = parsed(intent("sunset_view", ""))

    assert conversation_title(query, "x", "ru", FakeRegistry()) == "Сочи: вид на закат"


def test_english_title_uses_the_words_the_agent_recognized() -> None:
    query = parsed(intent("sunset_view", "sunset view"), intent("noise_level", "quiet"))

    assert conversation_title(query, "x", "en", FakeRegistry()) == "Сочи: sunset view, quiet"


def test_duplicate_wishes_are_dropped() -> None:
    query = ParsedQuery(
        intents=(intent("facility:pool", "с бассейном"), intent("sunset_view", "закат")),
        unmatched_terms=(),
        location_hint=None,
        facility_requests=(FacilityRequest(term="pool", source_text="С бассейном"),),
    )

    title = conversation_title(query, "x", "ru", FakeRegistry())

    assert title == "С бассейном, закат"


def test_location_alone_is_a_title() -> None:
    assert conversation_title(parsed(), "отель в Сочи", "ru", FakeRegistry()) == "Сочи"


def test_unparsed_request_falls_back_to_first_message_on_word_boundary() -> None:
    message = "  хочу   что-нибудь " + "очень необычное и уютное " * 5
    query = parsed(location=None)

    title = conversation_title(query, message, "ru", FakeRegistry())

    assert len(title) <= 60
    assert title.startswith("хочу что-нибудь очень необычное")
    assert title.endswith("…")
    assert not title.removesuffix("…").endswith(" ")
    assert title.removesuffix("…").split()[-1] in message.split()


def test_short_text_is_kept_whole() -> None:
    assert shorten("тихий номер", 60) == "тихий номер"


def test_rename_title_is_trimmed() -> None:
    assert validated_title("  Мой   отпуск ") == "Мой отпуск"


@pytest.mark.parametrize("title", ["", "   ", "а" * 81])
def test_rename_title_outside_bounds_is_rejected(title: str) -> None:
    with pytest.raises(InvalidConversationTitle):
        validated_title(title)


def test_rename_title_of_eighty_characters_is_accepted() -> None:
    assert validated_title("а" * 80) == "а" * 80
