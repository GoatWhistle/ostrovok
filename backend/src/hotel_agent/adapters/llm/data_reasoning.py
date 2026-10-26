import json
from collections.abc import Mapping
from typing import Any

from hotel_agent.adapters.llm.payload import flag, items, number, optional_text, text
from hotel_agent.adapters.llm.research_instructions import SYSTEM
from hotel_agent.application.agent.data_records import DataCheck, DataCriterion, DataStep
from hotel_agent.domain.errors import ModelFailure

__all__ = ["SYSTEM", "observed_fields", "schema", "step"]


def schema(known_fields: list[str] | None = None, finish_only: bool = False) -> dict[str, Any]:
    check = _object(
        {
            "field": {"type": "string", **({"enum": known_fields} if known_fields else {})},
            "op": {"type": "string", "enum": ["eq", "gte", "lte"]},
            "value": {"type": "number"},
        }
    )
    criterion = _object(
        {
            "term": {"type": "string"},
            "source_text": {"type": "string"},
            "checks": {"type": "array", "items": check},
            "required": {"type": "boolean"},
            "explanation": {"type": "string"},
        }
    )
    body = _object(
        {
            "action": {
                "type": "string",
                "enum": ["finish"]
                if finish_only
                else [
                    "inspect_data",
                    "search_documents",
                    "find_hotels",
                    "read_records",
                    "measure_terrain",
                    "measure_geometry",
                    "search_web",
                    "read_web_page",
                    "get_weather",
                    "get_room_offers",
                    "calculate_sun",
                    "assess_view",
                    "finish",
                ],
            },
            "arguments": _object(
                {
                    "query": {"type": ["string", "null"]},
                    "url": {"type": ["string", "null"]},
                    "hotel_id": {"type": ["string", "null"]},
                    "hotel_ids": {"type": "array", "items": {"type": "string"}},
                    "at": {"type": ["string", "null"]},
                    "direction_deg": {"type": ["number", "null"]},
                    "observer_height_m": {"type": ["number", "null"]},
                    "check_in": {"type": ["string", "null"]},
                    "check_out": {"type": ["string", "null"]},
                    "adults": {"type": ["integer", "null"]},
                    "term": {"type": ["string", "null"]},
                    "radius_m": {"type": ["number", "null"]},
                    "search_radius_m": {"type": ["number", "null"]},
                    "dataset": {"type": ["string", "null"]},
                    "filters": {
                        "type": "array",
                        "items": _object(
                            {
                                "field": {"type": "string"},
                                "op": {"type": "string", "enum": ["eq", "gte", "lte", "contains"]},
                                "value": {"type": ["boolean", "number", "string"]},
                            }
                        ),
                    },
                }
            ),
            "criteria": {"type": "array", "items": criterion},
            "question": {"type": ["string", "null"]},
        }
    )
    return {
        "type": "json_schema",
        "json_schema": {
            "name": "data_exploration_step",
            "strict": True,
            "schema": body,
        },
    }


def step(payload: Mapping[str, object]) -> DataStep:
    arguments = payload.get("arguments")
    if not isinstance(arguments, dict):
        raise ModelFailure("Data agent tool arguments must be an object")
    criteria = []
    for raw in items(payload, "criteria"):
        checks = []
        for check in items(raw, "checks"):
            checks.append(
                DataCheck(
                    field=text(check, "field"), op=text(check, "op"), value=number(check, "value")
                )
            )
        criteria.append(
            DataCriterion(
                term=text(raw, "term"),
                source_text=text(raw, "source_text"),
                checks=tuple(checks),
                required=flag(raw, "required"),
                explanation=text(raw, "explanation"),
            )
        )
    question = optional_text(payload, "question")
    if question is not None and ("?" not in question or len(question.strip()) < 12):
        question = None
    return DataStep(
        action=text(payload, "action"),
        arguments={str(key): value for key, value in arguments.items() if value is not None},
        criteria=tuple(criteria),
        question=question,
    )


def _object(properties: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": sorted(properties),
        "properties": properties,
    }


def observed_fields(context: str) -> list[str]:
    try:
        payload = json.loads(context)
    except json.JSONDecodeError:
        return ["unobserved"]
    if not isinstance(payload, dict):
        return ["unobserved"]
    found = set()
    for observation in payload.get("observations", []):
        result = observation.get("result", {})
        if isinstance(result.get("field"), str):
            found.add(result["field"])
        if isinstance(result.get("fields"), dict):
            found.update(result["fields"])
    return sorted(found) or ["unobserved"]
