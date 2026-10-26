from typing import Any

from hotel_agent.adapters.llm.payload import as_mapping
from hotel_agent.domain.errors import ModelFailure


def content_of(body: object) -> str:
    payload = as_mapping(body, raw=True)
    reason = payload.get("stop_reason")
    if reason != "end_turn":
        raise ModelFailure(f"Language model did not finish its answer: {reason}")
    if payload.get("stop_details") is not None:
        raise ModelFailure("Language model declined the request")
    content = payload.get("content")
    if not isinstance(content, list):
        raise ModelFailure("Language model returned no message content")
    parts = []
    for raw in content:
        block = as_mapping(raw, raw=True)
        if block.get("type") != "text":
            continue
        text = block.get("text")
        if not isinstance(text, str):
            raise ModelFailure("Language model returned invalid text content")
        parts.append(text)
    result = "".join(parts).strip()
    if not result:
        raise ModelFailure("Language model returned an empty answer")
    return result


def output_schema(schema: dict[str, Any]) -> dict[str, Any]:
    result = dict(schema)
    constraints = []
    for key in ("minimum", "maximum"):
        if key in result:
            constraints.append(f"{key}: {result.pop(key)}")
    if constraints:
        result["description"] = "; ".join([result.get("description", ""), *constraints]).strip("; ")
    if "properties" in result:
        result["properties"] = {
            key: output_schema(value) for key, value in result["properties"].items()
        }
    if "items" in result:
        result["items"] = output_schema(result["items"])
    for key in ("anyOf", "allOf"):
        if key in result:
            result[key] = [output_schema(value) for value in result[key]]
    return result
