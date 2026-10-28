import re

MINUTE_PER = {"sec": 1 / 60, "min": 1.0, "hour": 60.0, "day": 1440.0}
METRE_PER = {"m": 1.0, "km": 1000.0, "cm": 0.01}
DIMENSION = {"min": "time", "m": "length"}
SCALE = {"time": MINUTE_PER, "length": METRE_PER}
WORDS = (
    (r"секунд|сек\b", "sec"),
    (r"минут|мин\b", "min"),
    (r"час", "hour"),
    (r"сут|дн[еяй]", "day"),
    (r"километр|\bкм\b", "km"),
    (r"метр|\bм\b", "m"),
    (r"сантиметр|\bсм\b", "cm"),
)
NUMBER = re.compile(r"(\d+(?:[.,]\d+)?)\s*([^\d,;.]{0,24})")


def stated(text: str) -> tuple[float, str] | None:
    for raw, tail in NUMBER.findall(str(text).casefold().replace("ё", "е")):
        for pattern, unit in WORDS:
            if re.search(pattern, tail):
                return float(raw.replace(",", ".")), unit
    return None


def rescaled(text: str, unit: object, threshold: object) -> float | None:
    if not isinstance(unit, str) or unit not in DIMENSION:
        return None
    if isinstance(threshold, bool) or not isinstance(threshold, int | float):
        return None
    found = stated(text)
    if found is None:
        return None
    value, name = found
    scale = SCALE[DIMENSION[unit]]
    if name not in scale or value != threshold:
        return None
    converted = value * scale[name] / scale[unit]
    return None if converted == threshold else converted
