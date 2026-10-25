from collections.abc import Mapping, Sequence
from typing import Any


def field_value(record: Mapping[str, Any], path: str) -> Any:
    value: Any = record
    for part in path.split("."):
        if not isinstance(value, Mapping) or part not in value:
            return None
        value = value[part]
    return value


def fields(records: Sequence[Mapping[str, Any]]) -> list[str]:
    found = set()
    for record in records:
        for key, value in record.items():
            found.add(key)
            if isinstance(value, dict):
                found.update(f"{key}.{nested}" for nested in value)
    return sorted(found)


def compare(actual: Any, op: str, wanted: Any) -> bool:
    if actual is None:
        return False
    if op == "eq":
        return actual == wanted and (isinstance(actual, bool) == isinstance(wanted, bool))
    if op == "contains":
        if isinstance(actual, list):
            return any(str(wanted).casefold() in str(item).casefold() for item in actual)
        return str(wanted).casefold() in str(actual).casefold()
    if (
        isinstance(actual, int | float)
        and not isinstance(actual, bool)
        and isinstance(wanted, int | float)
        and not isinstance(wanted, bool)
    ):
        return actual >= wanted if op == "gte" else actual <= wanted if op == "lte" else False
    return False
