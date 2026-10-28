from pathlib import Path

import pytest

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.application.condition_keys import named_key


@pytest.fixture
def registry(characteristics_dir: Path) -> YamlCharacteristicRegistry:
    return YamlCharacteristicRegistry.from_directory(characteristics_dir)


def test_a_known_key_is_kept(registry: YamlCharacteristicRegistry) -> None:
    assert named_key("pets_policy", "что угодно", registry) == "pets_policy"


def test_a_wish_about_pets_finds_its_characteristic(
    registry: YamlCharacteristicRegistry,
) -> None:
    assert named_key("derived:33042779fc46", "с собакой", registry) == "pets_policy"
    assert named_key("derived:33042779fc46", "можно с питомцем", registry) == "pets_policy"


def test_a_wish_nobody_describes_keeps_its_generated_key(
    registry: YamlCharacteristicRegistry,
) -> None:
    assert named_key("derived:abc", "рядом ипподром", registry) == "derived:abc"
    assert named_key("derived:abc", "", registry) == "derived:abc"


def test_the_longest_matching_phrase_wins(registry: YamlCharacteristicRegistry) -> None:
    assert named_key("derived:abc", "тихий номер с видом на закат", registry) == "sunset_view"


def test_no_key_at_all_stays_missing(registry: YamlCharacteristicRegistry) -> None:
    assert named_key(None, "непонятное пожелание", registry) is None
