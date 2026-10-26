from pathlib import Path

import osmium

from hotel_agent.adapters.osm.tags import is_beach, is_building


def prepare_polygon_extract(source: Path, target: Path) -> int:
    if source.resolve() == target.resolve():
        raise ValueError("The polygon extract must not replace its source")
    count = 0
    with osmium.BackReferenceWriter(target, source, remove_tags=False, relation_depth=5) as writer:
        processor = osmium.FileProcessor(str(source), osmium.osm.WAY | osmium.osm.RELATION)
        processor = processor.with_filter(
            osmium.filter.KeyFilter("building", "building:part", "natural", "leisure")
        )
        for item in processor:
            tags = dict(item.tags)
            if is_building(tags) or is_beach(tags):
                writer.add(item)
                count += 1
    return count
