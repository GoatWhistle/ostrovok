from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
import yaml
from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from hotel_agent.main import create_app
from hotel_agent.settings import Settings

CONTRACT = Path(__file__).resolve().parents[3] / "docs" / "api" / "openapi.yaml"
BASE = "urn:hotel-agent:openapi"


@pytest.fixture(scope="session")
def contract() -> dict[str, Any]:
    document: dict[str, Any] = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return document


@pytest.fixture(scope="session")
def validate(contract: dict[str, Any]) -> Any:
    converted = _as_json_schema(contract)
    registry = Registry().with_resource(
        BASE, Resource.from_contents(converted, default_specification=DRAFT202012)
    )

    def check(schema_name: str, payload: object) -> None:
        validator = Draft202012Validator(
            {"$ref": f"{BASE}#/components/schemas/{schema_name}"}, registry=registry
        )
        errors = sorted(validator.iter_errors(payload), key=lambda error: list(error.path))
        assert not errors, "\n".join(
            f"{'/'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
            for error in errors
        )

    return check


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as started:
        yield started


def _as_json_schema(node: object) -> Any:
    if isinstance(node, list):
        return [_as_json_schema(item) for item in node]
    if not isinstance(node, dict):
        return node
    converted = {key: _as_json_schema(value) for key, value in node.items()}
    if converted.pop("nullable", False):
        converted = _allow_null(converted)
    return converted


def _allow_null(schema: dict[str, Any]) -> dict[str, Any]:
    declared = schema.get("type")
    if isinstance(declared, str):
        return {**schema, "type": [declared, "null"]}
    if isinstance(declared, list):
        return {**schema, "type": [*declared, "null"]}
    return {"anyOf": [schema, {"type": "null"}]}
