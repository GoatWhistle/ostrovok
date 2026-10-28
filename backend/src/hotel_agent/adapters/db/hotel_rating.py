from math import isfinite


def read_hotel_rating(content: object) -> float | None:
    if not isinstance(content, list):
        return None
    for item in content:
        rating = item.get("rating") if isinstance(item, dict) else None
        value = rating.get("total") if isinstance(rating, dict) else None
        if (
            isinstance(value, int | float)
            and not isinstance(value, bool)
            and isfinite(value)
            and 0 <= value <= 10
        ):
            return float(value)
    return None
