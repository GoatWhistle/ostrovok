from collections.abc import Mapping, Sequence
from enum import StrEnum
from pathlib import Path
from typing import Self

import yaml

from hotel_agent.domain.characteristics import (
    BetterDirection,
    Characteristic,
    CompareGroup,
    CompareHint,
    Display,
    FieldKind,
    FieldRule,
    GeoStyle,
    Matcher,
    Op,
    ScalarValue,
    Scope,
    SourceType,
    ValueType,
)
from hotel_agent.domain.errors import InvalidRegistry, UnknownCharacteristic


class YamlCharacteristicRegistry:
    def __init__(self, items: Sequence[Characteristic]) -> None:
        self._items = tuple(sorted(items, key=lambda item: item.key))
        self._by_key = {item.key: item for item in self._items}
        if len(self._by_key) != len(self._items):
            raise InvalidRegistry("characteristic keys are not unique")

    @classmethod
    def from_directory(cls, directory: Path) -> Self:
        if not directory.is_dir():
            raise InvalidRegistry(f"{directory} is not a directory")
        paths = sorted(directory.glob("*.yaml"))
        if not paths:
            raise InvalidRegistry(f"{directory} holds no characteristic files")
        return cls([_characteristic(path) for path in paths])

    def all(self) -> Sequence[Characteristic]:
        return self._items

    def get(self, key: str) -> Characteristic:
        item = self._by_key.get(key)
        if item is None:
            raise UnknownCharacteristic(f"Characteristic {key!r} is not registered")
        return item


def _characteristic(path: Path) -> Characteristic:
    where = path.name
    data = _mapping(yaml.safe_load(path.read_text(encoding="utf-8")), where)
    key = _text(data, "key", where)
    if key != path.stem:
        raise InvalidRegistry(f"{where}: key {key!r} does not match the file name")
    return Characteristic(
        key=key,
        title_ru=_text(data, "title_ru", where),
        description=_text(data, "description", where),
        value_type=_choice(data, "value_type", ValueType, where),
        unit=_optional_text(data, "unit", where),
        scope=_choice(data, "scope", Scope, where),
        conflict_tolerance=_non_negative(data, "conflict_tolerance", where),
        synonyms=tuple(_text_list(data, "synonyms", where)),
        matchers=tuple(_matcher(item, where) for item in _list(data, "matchers", where)),
        fields=tuple(_field_rule(item, where) for item in _list(data, "fields", where)),
        tool=_optional_text(data, "tool", where),
        ttl_days=_integer(data, "ttl_days", where),
        precompute=_flag(data, "precompute", where),
        ask_hotelier_if_missing=_flag(data, "ask_hotelier_if_missing", where),
        question_template=_optional_text(data, "question_template", where),
        source_kinds=tuple(
            _parse_choice(item, SourceType, f"{where}.source_kinds")
            for item in _text_list(data, "source_kinds", where)
        ),
        compare=_compare(data.get("compare"), where),
        display=_display(_mapping(data.get("display"), f"{where}.display"), where),
    )


def _compare(raw: object, where: str) -> CompareHint | None:
    if raw is None:
        return None
    data = _mapping(raw, f"{where}.compare")
    better = _optional_text(data, "better", where)
    return CompareHint(
        group=_choice(data, "group", CompareGroup, where),
        better=_parse_choice(better, BetterDirection, where) if better else None,
    )


def _display(data: Mapping[str, object], where: str) -> Display:
    return Display(
        icon=_text(data, "icon", where),
        color=_text(data, "color", where),
        geo_style=_choice(data, "geo_style", GeoStyle, where),
    )


def _matcher(raw: object, where: str) -> Matcher:
    data = _mapping(raw, f"{where}.matchers")
    return Matcher(
        phrase=_text(data, "phrase", where).casefold(),
        op=_choice(data, "op", Op, where),
        value=_scalar(data.get("value"), f"{where}.matchers.value"),
        weight=_number(data, "weight", where),
        required=_flag(data, "required", where),
    )


def _field_rule(raw: object, where: str) -> FieldRule:
    data = _mapping(raw, f"{where}.fields")
    return FieldRule(
        name=_text(data, "name", where),
        kind=_choice(data, "kind", FieldKind, where),
        units=tuple(item.casefold() for item in _text_list(data, "units", where)),
        positive=tuple(item.casefold() for item in _text_list(data, "positive", where)),
        negative=tuple(item.casefold() for item in _text_list(data, "negative", where)),
    )


def _mapping(raw: object, where: str) -> Mapping[str, object]:
    if not isinstance(raw, dict):
        raise InvalidRegistry(f"{where}: expected a mapping")
    return {str(key): value for key, value in raw.items()}


def _list(data: Mapping[str, object], key: str, where: str) -> Sequence[object]:
    raw = data.get(key)
    if raw is None:
        return ()
    if not isinstance(raw, list):
        raise InvalidRegistry(f"{where}.{key}: expected a list")
    return raw


def _text_list(data: Mapping[str, object], key: str, where: str) -> Sequence[str]:
    values = []
    for item in _list(data, key, where):
        if not isinstance(item, str):
            raise InvalidRegistry(f"{where}.{key}: expected strings")
        values.append(item)
    return values


def _text(data: Mapping[str, object], key: str, where: str) -> str:
    raw = data.get(key)
    if not isinstance(raw, str) or not raw.strip():
        raise InvalidRegistry(f"{where}.{key}: expected a non-empty string")
    return raw


def _optional_text(data: Mapping[str, object], key: str, where: str) -> str | None:
    raw = data.get(key)
    if raw is None:
        return None
    if not isinstance(raw, str) or not raw.strip():
        raise InvalidRegistry(f"{where}.{key}: expected a non-empty string or null")
    return raw


def _integer(data: Mapping[str, object], key: str, where: str) -> int:
    raw = data.get(key)
    if not isinstance(raw, int) or isinstance(raw, bool) or raw <= 0:
        raise InvalidRegistry(f"{where}.{key}: expected a positive integer")
    return raw


def _number(data: Mapping[str, object], key: str, where: str) -> float:
    raw = data.get(key)
    if isinstance(raw, bool) or not isinstance(raw, int | float):
        raise InvalidRegistry(f"{where}.{key}: expected a number")
    return float(raw)


def _non_negative(data: Mapping[str, object], key: str, where: str) -> float:
    value = _number(data, key, where)
    if value < 0:
        raise InvalidRegistry(f"{where}.{key}: expected a number at or above zero")
    return value


def _flag(data: Mapping[str, object], key: str, where: str) -> bool:
    raw = data.get(key)
    if not isinstance(raw, bool):
        raise InvalidRegistry(f"{where}.{key}: expected true or false")
    return raw


def _scalar(raw: object, where: str) -> ScalarValue:
    if raw is None or isinstance(raw, bool | str):
        return raw
    if isinstance(raw, int | float):
        return float(raw)
    raise InvalidRegistry(f"{where}: expected a boolean, number, string or null")


def _choice[E: StrEnum](data: Mapping[str, object], key: str, kind: type[E], where: str) -> E:
    return _parse_choice(_text(data, key, where), kind, f"{where}.{key}")


def _parse_choice[E: StrEnum](raw: str, kind: type[E], where: str) -> E:
    try:
        return kind(raw)
    except ValueError:
        allowed = ", ".join(member.value for member in kind)
        raise InvalidRegistry(f"{where}: {raw!r} is not one of: {allowed}") from None
