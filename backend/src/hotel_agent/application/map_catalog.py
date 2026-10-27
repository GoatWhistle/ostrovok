from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Literal

MapLayer = Literal["ground", "volume", "prop", "poi"]
CATALOG_VERSION = "1"


@dataclass(frozen=True, slots=True)
class TagRule:
    tag: str
    values: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class MapClass:
    key: str
    layer: MapLayer
    match: tuple[TagRule, ...]
    priority: int
    min_zoom: int
    style: dict[str, str]
    props: dict[str, str | float] | None = None


class MapCatalog:
    def __init__(self, classes: Sequence[MapClass]) -> None:
        self.classes = tuple(sorted(classes, key=lambda item: (-item.priority, item.key)))

    def classify(self, tags: Mapping[str, str], layer: MapLayer) -> MapClass:
        for item in self.classes:
            if item.layer != layer:
                continue
            if any(
                rule.tag in tags and (tags[rule.tag] in rule.values or "*" in rule.values)
                for rule in item.match
            ):
                return item
        return next(item for item in self.classes if item.layer == layer and not item.match)

    def building(
        self,
        tags: Mapping[str, str],
        hotel: bool,
        pois: Sequence[Mapping[str, str]],
        landuse: str | None,
        area: float,
        levels: int | None,
    ) -> tuple[str, str]:
        explicit = self.classify({"building": tags.get("building", "yes")}, "volume")
        if explicit.match:
            return explicit.key, "tag"
        if hotel:
            return self.classify({"tourism": "hotel"}, "volume").key, "hotel"
        candidates = [self.classify(poi, "volume") for poi in pois]
        if known := sorted(
            (item for item in candidates if item.match), key=lambda item: (-item.priority, item.key)
        ):
            return known[0].key, "poi"
        if landuse:
            inferred = self.classify({"landuse": landuse}, "volume")
            if inferred.match:
                return inferred.key, "landuse"
        if area < 40 and levels is not None and levels <= 1:
            return self.classify({"building": "shed"}, "volume").key, "size"
        return explicit.key, "default"
