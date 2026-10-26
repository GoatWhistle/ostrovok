from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.domain.errors import InvalidConversationTitle, UnknownCharacteristic
from hotel_agent.domain.query import Intent, ParsedQuery

TITLE_MAX_LENGTH = 80
FALLBACK_LENGTH = 60
WISH_LIMIT = 3


def conversation_title(
    parsed: ParsedQuery, message: str, locale: str, registry: CharacteristicRegistryPort
) -> str:
    location = (parsed.location_hint or "").strip()
    wishes = _wishes(parsed, locale, registry)
    if location and wishes:
        title = f"{location}: {', '.join(wishes)}"
    elif location:
        title = location
    elif wishes:
        title = _capitalized(", ".join(wishes))
    else:
        return shorten(" ".join(message.split()), FALLBACK_LENGTH)
    return shorten(title, TITLE_MAX_LENGTH)


def validated_title(title: str) -> str:
    cleaned = " ".join(title.split())
    if not cleaned or len(cleaned) > TITLE_MAX_LENGTH:
        raise InvalidConversationTitle()
    return cleaned


def shorten(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[: limit - 1]
    boundary = cut.rfind(" ")
    if boundary > limit // 2:
        cut = cut[:boundary]
    return cut.rstrip(" ,.;:-") + "…"


def _wishes(parsed: ParsedQuery, locale: str, registry: CharacteristicRegistryPort) -> list[str]:
    labels = [_intent_label(intent, locale, registry) for intent in parsed.intents]
    labels.extend(item.source_text for item in parsed.nearby_objects)
    labels.extend(item.source_text for item in parsed.facility_requests)
    labels.extend(item.source_text for item in parsed.spatial_requests)
    unique: dict[str, str] = {}
    for label in labels:
        cleaned = " ".join(label.split())
        if cleaned and cleaned.casefold() not in unique:
            unique[cleaned.casefold()] = cleaned
    return list(unique.values())[:WISH_LIMIT]


def _intent_label(intent: Intent, locale: str, registry: CharacteristicRegistryPort) -> str:
    if intent.source_text.strip() or locale != "ru":
        return intent.source_text.strip()
    try:
        title = registry.get(intent.characteristic_key).title_ru
    except UnknownCharacteristic:
        return intent.source_text
    return title[:1].lower() + title[1:] if title else intent.source_text


def _capitalized(text: str) -> str:
    return text[:1].upper() + text[1:]
