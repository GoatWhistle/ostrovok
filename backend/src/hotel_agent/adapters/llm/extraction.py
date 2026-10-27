import re

from hotel_agent.adapters.llm.text import normalize
from hotel_agent.application.ports.llm import ExtractedField
from hotel_agent.domain.characteristics import Characteristic, FieldKind, FieldRule

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
SHORT_ANSWERS = {"да": True, "yes": True, "нет": False, "no": False}


def extract(characteristic: Characteristic, answer: str) -> tuple[ExtractedField, ...]:
    text = normalize(answer)
    fields = []
    for rule in characteristic.fields:
        field = (
            _bool_field(rule, text) if rule.kind is FieldKind.BOOL else _number_field(rule, text)
        )
        if field is not None:
            fields.append(field)
    return tuple(fields) or _short_answer(characteristic, text)


def _short_answer(characteristic: Characteristic, text: str) -> tuple[ExtractedField, ...]:
    word = text.strip(" .!")
    rule = next((item for item in characteristic.fields if item.kind is FieldKind.BOOL), None)
    if rule is None or word not in SHORT_ANSWERS:
        return ()
    return (ExtractedField(name=rule.name, value=SHORT_ANSWERS[word], quote=word),)


def _bool_field(rule: FieldRule, text: str) -> ExtractedField | None:
    negative = _first_phrase(rule.negative, text)
    if negative is not None:
        return ExtractedField(name=rule.name, value=False, quote=negative)
    positive = _first_phrase(rule.positive, text)
    if positive is not None:
        return ExtractedField(name=rule.name, value=True, quote=positive)
    return None


def _number_field(rule: FieldRule, text: str) -> ExtractedField | None:
    for unit in rule.units:
        at = text.find(unit)
        while at != -1:
            number = _number_before(text, at)
            if number is not None:
                value, start = number
                return ExtractedField(
                    name=rule.name, value=value, quote=text[start : at + len(unit)]
                )
            at = text.find(unit, at + len(unit))
    return None


def _number_before(text: str, at: int) -> tuple[float, int] | None:
    matches = [match for match in NUMBER.finditer(text, 0, at) if at - match.end() <= 2]
    if not matches:
        return None
    last = matches[-1]
    return float(last.group().replace(",", ".")), last.start()


def _first_phrase(phrases: tuple[str, ...], text: str) -> str | None:
    found = [phrase for phrase in phrases if phrase in text]
    return min(found, key=lambda phrase: text.find(phrase)) if found else None
