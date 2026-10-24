from pathlib import Path

import pytest

from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.domain.characteristics import Op, Scope, ValueType
from hotel_agent.domain.errors import InvalidRegistry, UnknownCharacteristic

MINIMAL = """
key: pool_heated
title_ru: Подогреваемый бассейн
description: Бассейн с подогревом по словам отельера.
value_type: bool
unit: null
scope: hotel
tool: null
ttl_days: 365
precompute: false
ask_hotelier_if_missing: true
question_template: Подогревается ли бассейн в {hotel}?
source_kinds: [hotelier]
display:
  icon: pool
  color: "#00ACC1"
  geo_style: polygon
synonyms: [бассейн с подогревом]
matchers:
  - phrase: подогреваемый бассейн
    op: eq
    value: true
    weight: 1.0
    required: false
fields: []
"""


def write(directory: Path, name: str, body: str) -> Path:
    path = directory / name
    path.write_text(body, encoding="utf-8")
    return path


def test_registry_reads_the_project_files(characteristics_dir: Path) -> None:
    registry = YamlCharacteristicRegistry.from_directory(characteristics_dir)

    keys = [item.key for item in registry.all()]
    assert keys == sorted(keys)
    assert "distance_to_sea" in keys
    sea = registry.get("distance_to_sea")
    assert (sea.value_type, sea.unit, sea.scope) == (ValueType.NUMBER, "min", Scope.HOTEL)
    assert sea.precompute is True


def test_a_new_file_joins_the_registry_without_code_changes(tmp_path: Path) -> None:
    write(tmp_path, "pool_heated.yaml", MINIMAL)

    registry = YamlCharacteristicRegistry.from_directory(tmp_path)
    added = registry.get("pool_heated")

    assert [item.key for item in registry.all()] == ["pool_heated"]
    assert added.ask_hotelier_if_missing is True
    assert added.matchers[0].op is Op.EQ
    assert added.question_template == "Подогревается ли бассейн в {hotel}?"


def test_unknown_key_is_reported(tmp_path: Path) -> None:
    write(tmp_path, "pool_heated.yaml", MINIMAL)

    with pytest.raises(UnknownCharacteristic, match="'sauna'"):
        YamlCharacteristicRegistry.from_directory(tmp_path).get("sauna")


@pytest.mark.parametrize(
    ("name", "body", "message"),
    [
        ("sauna.yaml", MINIMAL, "does not match the file name"),
        (
            "pool_heated.yaml",
            MINIMAL.replace("value_type: bool", "value_type: colour"),
            "value_type: 'colour' is not one of",
        ),
        (
            "pool_heated.yaml",
            MINIMAL.replace("ttl_days: 365", "ttl_days: 0"),
            "ttl_days: expected a positive integer",
        ),
        (
            "pool_heated.yaml",
            MINIMAL.replace("    op: eq", "    op: between"),
            "op: 'between' is not one of",
        ),
        (
            "pool_heated.yaml",
            MINIMAL.replace("precompute: false", "precompute: maybe"),
            "precompute: expected true or false",
        ),
    ],
)
def test_broken_file_names_the_problem(tmp_path: Path, name: str, body: str, message: str) -> None:
    write(tmp_path, name, body)

    with pytest.raises(InvalidRegistry, match=message):
        YamlCharacteristicRegistry.from_directory(tmp_path)


def test_empty_directory_is_reported(tmp_path: Path) -> None:
    with pytest.raises(InvalidRegistry, match="holds no characteristic files"):
        YamlCharacteristicRegistry.from_directory(tmp_path)
