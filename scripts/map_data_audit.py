import argparse
import gzip
import json
from datetime import UTC, datetime
from pathlib import Path

THRESHOLDS = {"landcover": 1000, "natural_areas": 500, "leisure": 500, "trees": 1000, "water": 50}


def audit(source: Path) -> dict[str, object]:
    payload = json.load(gzip.open(source))
    counts = dict.fromkeys(THRESHOLDS, 0)
    for element in payload["elements"]:
        tags = element.get("tags", {})
        nodes = element.get("nodes", [])
        area = element["type"] == "relation" or (len(nodes) > 3 and nodes[0] == nodes[-1])
        counts["landcover"] += bool(area and ("landuse" in tags or "landcover" in tags))
        counts["natural_areas"] += bool(area and tags.get("natural") in {"wood", "scrub", "grassland", "water"})
        counts["leisure"] += bool(area and tags.get("leisure") in {"park", "garden", "pitch", "swimming_pool"})
        counts["trees"] += bool(element["type"] == "node" and tags.get("natural") == "tree")
        counts["water"] += bool(area and (tags.get("natural") == "water" or tags.get("waterway") == "riverbank"))
    return {"at": datetime.now(UTC).isoformat(), "source": str(source), "counts": counts,
            "thresholds": THRESHOLDS, "download_required": any(counts[key] < value for key, value in THRESHOLDS.items())}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    print(json.dumps(audit(args.source), indent=2))
