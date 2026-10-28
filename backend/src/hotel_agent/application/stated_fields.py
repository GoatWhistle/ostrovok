import json
from collections.abc import Mapping

from hotel_agent.application.fact_values import checked_value
from hotel_agent.application.ports.llm import ExtractedField, Extraction
from hotel_agent.domain.characteristics import Characteristic, FieldKind, ScalarValue, ValueType
from hotel_agent.domain.errors import InvalidValue

KIND_OF_FIELD = {FieldKind.BOOL: ValueType.BOOL, FieldKind.NUMBER: ValueType.NUMBER}


def fields_extraction(
    characteristic: Characteristic, fields: Mapping[str, ScalarValue]
) -> Extraction:
    if not characteristic.fields:
        raise InvalidValue(f"Characteristic {characteristic.key} has no answer fields")
    given = {name: value for name, value in fields.items() if value is not None}
    if not given:
        raise InvalidValue("A structured answer needs at least one value")
    rules = {rule.name: rule for rule in characteristic.fields}
    unknown = sorted(set(given) - set(rules))
    if unknown:
        raise InvalidValue(f"Unknown answer field {unknown[0]}")
    checked: dict[str, ScalarValue] = {}
    for name, value in given.items():
        item = checked_value(value, KIND_OF_FIELD[rules[name].kind])
        if isinstance(item, float) and item < 0:
            raise InvalidValue("Value must be nonnegative")
        checked[name] = item if isinstance(item, bool | float) else value
    return Extraction(
        characteristic_key=characteristic.key,
        fields=tuple(
            ExtractedField(name=name, value=value, quote=f"{name}={json.dumps(value)}")
            for name, value in checked.items()
        ),
    )
