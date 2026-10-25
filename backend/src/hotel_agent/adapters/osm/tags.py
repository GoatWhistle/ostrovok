from collections.abc import Mapping

HOTEL_TOURISM = frozenset(
    {"hotel", "hostel", "guest_house", "apartment", "motel", "resort", "chalet"}
)
LOUD_HIGHWAY = frozenset({"motorway", "trunk", "primary", "secondary"})
WALKABLE_HIGHWAY = frozenset(
    {
        "footway",
        "path",
        "pedestrian",
        "steps",
        "living_street",
        "residential",
        "service",
        "unclassified",
        "tertiary",
        "secondary",
        "primary",
        "track",
        "cycleway",
    }
)
NO_FOOT = frozenset({"no", "private"})

HOTEL_KEYS = (
    "name",
    "name:en",
    "tourism",
    "stars",
    "operator",
    "website",
    "phone",
    "addr:street",
    "addr:housenumber",
    "addr:city",
)
BUILDING_KEYS = ("building", "height", "building:levels", "min_height", "roof:shape", "name")
POI_KEYS = (
    "name",
    "opening_hours",
    "amenity",
    "shop",
    "leisure",
    "tourism",
    "historic",
    "natural",
    "healthcare",
    "office",
    "craft",
    "man_made",
    "emergency",
    "public_transport",
    "railway",
    "aeroway",
    "sport",
)
WALK_KEYS = ("highway", "foot", "access", "surface", "incline")
NOISE_KEYS = ("highway", "railway", "name", "maxspeed", "lanes")


def is_hotel(tags: Mapping[str, str]) -> bool:
    return tags.get("tourism", "") in HOTEL_TOURISM


def is_building(tags: Mapping[str, str]) -> bool:
    return "building" in tags and tags.get("building") != "no"


def is_poi(tags: Mapping[str, str]) -> bool:
    return any(tags.get(key) for key in POI_KEYS if key not in {"name", "opening_hours"})


def is_coastline(tags: Mapping[str, str]) -> bool:
    return tags.get("natural") == "coastline"


def is_beach(tags: Mapping[str, str]) -> bool:
    return tags.get("natural") == "beach" or tags.get("leisure") == "beach_resort"


def is_noise_source(tags: Mapping[str, str]) -> bool:
    return tags.get("highway", "") in LOUD_HIGHWAY or tags.get("railway") == "rail"


def is_walkable(tags: Mapping[str, str]) -> bool:
    if tags.get("highway", "") not in WALKABLE_HIGHWAY:
        return False
    if tags.get("foot", "") in NO_FOOT:
        return False
    return tags.get("access", "") not in NO_FOOT


def selected(tags: Mapping[str, str], keys: tuple[str, ...]) -> dict[str, str]:
    return {key: tags[key] for key in keys if key in tags}
