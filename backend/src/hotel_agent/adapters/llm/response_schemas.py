from collections.abc import Sequence
from typing import Any

from hotel_agent.domain.characteristics import Characteristic, Op
from hotel_agent.domain.query import OSM_OBJECT_KEYS

SCALAR = {"type": ["boolean", "number", "string", "null"]}


def parse_query_schema(registry: Sequence[Characteristic]) -> dict[str, Any]:
    return _schema(
        "parsed_query",
        {
            "intents": {
                "type": "array",
                "items": _object(
                    {
                        "characteristic_key": {
                            "type": "string",
                            "enum": [item.key for item in registry],
                        },
                        "op": {"type": "string", "enum": [member.value for member in Op]},
                        "value": SCALAR,
                        "weight": {"type": "number", "minimum": 0, "maximum": 1},
                        "required": {"type": "boolean"},
                        "source_text": {"type": "string"},
                    }
                ),
            },
            "unmatched_terms": {"type": "array", "items": {"type": "string"}},
            "location_hint": {"type": ["string", "null"]},
            "anywhere": {"type": "boolean"},
            "normalized_query": {"type": "string"},
            "needs_clarification": {"type": "boolean"},
            "wants_room": {"type": "boolean"},
            "room_preferences_unrestricted": {"type": "boolean"},
            "budget": {"type": ["string", "null"]},
            "check_in": {"type": ["string", "null"]},
            "check_out": {"type": ["string", "null"]},
            "adults": {"type": ["integer", "null"]},
            "corrections": {
                "type": "array",
                "items": _object(
                    {
                        "original": {"type": "string"},
                        "corrected": {"type": "string"},
                        "reason": {"type": "string"},
                    }
                ),
            },
            "nearby_objects": {
                "type": "array",
                "items": _object(
                    {
                        "osm_key": {"type": "string", "enum": list(OSM_OBJECT_KEYS)},
                        "osm_value": {"type": "string"},
                        "open_24h": {"type": "boolean"},
                        "avoid": {"type": "boolean"},
                        "required": {"type": "boolean"},
                        "radius_m": {"type": "integer"},
                        "source_text": {"type": "string"},
                    }
                ),
            },
            "facility_requests": {
                "type": "array",
                "items": _object(
                    {
                        "term": {"type": "string"},
                        "source_text": {"type": "string"},
                        "required": {"type": "boolean"},
                    }
                ),
            },
            "spatial_requests": {
                "type": "array",
                "items": _object(
                    {
                        "kind": {
                            "type": "string",
                            "enum": [
                                "city_center",
                                "landmark_view",
                                "landmark_nearby",
                                "landmark_distance_min",
                                "sea_view",
                            ],
                        },
                        "target": {"type": ["string", "null"]},
                        "radius_m": {"type": "integer"},
                        "source_text": {"type": "string"},
                        "required": {"type": "boolean"},
                    }
                ),
            },
        },
    )


def plan_tools_schema(registry: Sequence[Characteristic]) -> dict[str, Any]:
    keys = [item.key for item in registry if item.tool is not None]
    return _schema(
        "tool_plan",
        {
            "calls": {
                "type": "array",
                "items": _object(
                    {
                        "characteristic_key": {"type": "string", "enum": keys or ["none"]},
                        "subject": {"type": "string"},
                    }
                ),
            }
        },
    )


def extract_fields_schema(characteristic: Characteristic) -> dict[str, Any]:
    names = [rule.name for rule in characteristic.fields]
    return _schema(
        "extracted_fields",
        {
            "fields": {
                "type": "array",
                "items": _object(
                    {
                        "name": {"type": "string", "enum": names or ["none"]},
                        "value": SCALAR,
                        "quote": {"type": "string"},
                    }
                ),
            }
        },
    )


def _schema(name: str, properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "json_schema",
        "json_schema": {"name": name, "strict": True, "schema": _object(properties)},
    }


def _object(properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": sorted(properties),
        "properties": properties,
    }
