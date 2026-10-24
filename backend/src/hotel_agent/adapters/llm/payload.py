import json
from collections.abc import Mapping

from hotel_agent.domain.characteristics import ScalarValue
from hotel_agent.domain.errors import ModelFailure


def content_of(body: object) -> str:
    payload = as_mapping(body, raw=True)
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ModelFailure("Language model returned no choices")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str):
        raise ModelFailure("Language model returned no message content")
    return content


def as_mapping(body: object, *, raw: bool = False) -> Mapping[str, object]:
    value = body if raw or not isinstance(body, str) else _decode(body)
    if not isinstance(value, dict):
        raise ModelFailure("Language model returned a non-object answer")
    return {str(key): item for key, item in value.items()}


def _decode(body: str) -> object:
    try:
        return json.loads(body)
    except json.JSONDecodeError as error:
        raise ModelFailure("Language model returned prose instead of JSON") from error


def items(payload: Mapping[str, object], key: str) -> list[Mapping[str, object]]:
    raw = payload.get(key)
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ModelFailure(f"Language model returned {key!r} as {type(raw).__name__}")
    return [as_mapping(item, raw=True) for item in raw]


def strings(payload: Mapping[str, object], key: str) -> list[str]:
    raw = payload.get(key)
    return [item for item in raw if isinstance(item, str)] if isinstance(raw, list) else []


def text(payload: Mapping[str, object], key: str) -> str:
    raw = payload.get(key)
    if not isinstance(raw, str):
        raise ModelFailure(f"Language model returned no {key!r}")
    return raw


def optional_text(payload: Mapping[str, object], key: str) -> str | None:
    raw = payload.get(key)
    return raw if isinstance(raw, str) and raw.strip() else None


def scalar(payload: Mapping[str, object], key: str) -> ScalarValue:
    raw = payload.get(key)
    if raw is None or isinstance(raw, bool | str):
        return raw
    if isinstance(raw, int | float):
        return float(raw)
    raise ModelFailure(f"Language model returned {key!r} as {type(raw).__name__}")


def number(payload: Mapping[str, object], key: str) -> float:
    raw = payload.get(key)
    if isinstance(raw, bool) or not isinstance(raw, int | float):
        raise ModelFailure(f"Language model returned no numeric {key!r}")
    return float(raw)


def flag(payload: Mapping[str, object], key: str) -> bool:
    raw = payload.get(key)
    return raw if isinstance(raw, bool) else False
