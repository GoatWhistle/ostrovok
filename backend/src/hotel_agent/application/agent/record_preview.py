from typing import Any


def preview(value: Any, depth: int = 0) -> Any:
    if isinstance(value, str):
        return value[:1600]
    if isinstance(value, dict):
        return {key: preview(item, depth + 1) for key, item in list(value.items())[:20]}
    if isinstance(value, list):
        return [preview(item, depth + 1) for item in value[:8]] if depth < 3 else value[:2]
    return value
