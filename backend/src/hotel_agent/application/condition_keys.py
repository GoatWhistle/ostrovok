from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.domain.characteristics import Characteristic

GENERATED_PREFIXES = ("derived:", "spatial:", "facility:")


def named_key(key: str | None, condition: str, registry: CharacteristicRegistryPort) -> str | None:
    if key is not None and not key.startswith(GENERATED_PREFIXES):
        return key
    phrase = condition.strip().casefold()
    if not phrase:
        return key
    best: tuple[int, str] | None = None
    for item in registry.all():
        matched = _phrase_length(item, phrase)
        if matched is not None and (best is None or matched > best[0]):
            best = (matched, item.key)
    return best[1] if best is not None else key


def _phrase_length(item: Characteristic, phrase: str) -> int | None:
    known = [matcher.phrase for matcher in item.matchers] + list(item.synonyms)
    hits = [len(word) for word in known if word and word.casefold() in phrase]
    return max(hits) if hits else None
