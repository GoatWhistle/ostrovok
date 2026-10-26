from collections.abc import Iterator
from pathlib import Path

import osmium

from hotel_agent.adapters.osm.tags import is_hotel
from hotel_agent.application.ports.geography import HotelTags


def iter_hotel_tags(path: Path) -> Iterator[HotelTags]:
    for item in osmium.FileProcessor(str(path)).with_filter(osmium.filter.KeyFilter("tourism")):
        tags = dict(item.tags)
        if not is_hotel(tags):
            continue
        if isinstance(item, osmium.osm.Node):
            prefix = "n"
        elif isinstance(item, osmium.osm.Way):
            prefix = "w"
        elif isinstance(item, osmium.osm.Relation):
            prefix = "r"
        else:
            continue
        yield HotelTags(f"{prefix}{item.id}", tags)
