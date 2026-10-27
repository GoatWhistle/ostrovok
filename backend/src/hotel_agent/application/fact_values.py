import math
from collections.abc import Mapping

from hotel_agent.domain.characteristics import ScalarValue, ValueType
from hotel_agent.domain.entities import FactValue
from hotel_agent.domain.errors import InvalidValue


def checked_value(value: object, kind: ValueType) -> FactValue:
    if kind is ValueType.BOOL and isinstance(value, bool):
        return value
    if (
        kind is ValueType.NUMBER
        and isinstance(value, int | float)
        and not isinstance(value, bool)
        and math.isfinite(value)
    ):
        return float(value)
    if kind in (ValueType.TEXT, ValueType.ENUM) and isinstance(value, str) and value.strip():
        return value
    if kind is ValueType.OBJECT and isinstance(value, Mapping) and value:
        result: dict[str, ScalarValue] = {}
        for key, item in value.items():
            if not isinstance(key, str) or not isinstance(
                item, str | bool | int | float | type(None)
            ):
                raise InvalidValue("Object fields must be scalar values")
            if (
                isinstance(item, int | float)
                and not isinstance(item, bool)
                and not math.isfinite(item)
            ):
                raise InvalidValue("Numbers must be finite")
            result[key] = item
        return result
    raise InvalidValue(f"Value must have type {kind.value}")
