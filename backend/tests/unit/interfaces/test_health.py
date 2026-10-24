from fastapi.testclient import TestClient

from hotel_agent.main import create_app
from hotel_agent.settings import Settings


def test_health_reports_liveness_and_provider(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "llm_provider": "fake"}


def test_openapi_lists_the_contract_routes(settings: Settings) -> None:
    with TestClient(create_app(settings)) as client:
        schema = client.get("/openapi.json").json()

    assert {"/api/v1/health", "/api/v1/characteristics"} <= set(schema["paths"])
