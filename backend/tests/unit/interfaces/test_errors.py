from dataclasses import dataclass, field

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from hotel_agent.application.ports.log import LogValue
from hotel_agent.domain.errors import DomainError, HotelNotFound, InvalidQuery, ModelFailure
from hotel_agent.interfaces.http.errors import ErrorHandlers


@dataclass
class RecordingLogger:
    records: list[tuple[str, str, BaseException | None, dict[str, LogValue]]] = field(
        default_factory=list
    )

    def info(self, event: str, **fields: LogValue) -> None:
        self.records.append(("info", event, None, fields))

    def warning(self, event: str, **fields: LogValue) -> None:
        self.records.append(("warning", event, None, fields))

    def error(self, event: str, *, exc: BaseException | None = None, **fields: LogValue) -> None:
        self.records.append(("error", event, exc, fields))


class Payload(BaseModel):
    count: int


def build_client(error: Exception, logger: RecordingLogger | None = None) -> TestClient:
    app = FastAPI()
    ErrorHandlers(logger or RecordingLogger()).register(app)

    @app.get("/fail")
    async def fail() -> None:
        raise error

    @app.post("/echo")
    async def echo(payload: Payload) -> Payload:
        return payload

    return TestClient(app, raise_server_exceptions=False)


@pytest.mark.parametrize(
    ("error", "status", "body"),
    [
        (
            InvalidQuery("Query holds no known characteristic"),
            422,
            {"code": "invalid_query", "message": "Query holds no known characteristic"},
        ),
        (
            ModelFailure("Language model failed: HTTP 500 token=secret"),
            503,
            {"code": "model_failure", "message": "Language model failed"},
        ),
        (
            HotelNotFound("Hotel h_1 is unknown"),
            404,
            {"code": "not_found", "message": "Hotel h_1 is unknown"},
        ),
        (DomainError("unmapped"), 500, {"code": "internal_error", "message": "Internal error"}),
        (RuntimeError("boom"), 500, {"code": "internal_error", "message": "Internal error"}),
    ],
)
def test_failures_use_error_envelope(error: Exception, status: int, body: dict[str, str]) -> None:
    response = build_client(error).get("/fail")

    assert response.status_code == status
    assert response.json() == body


def test_validation_error_names_fields() -> None:
    response = build_client(RuntimeError()).post("/echo", json={"count": "many"})

    assert response.status_code == 422
    assert response.json() == {
        "code": "validation_error",
        "message": "Invalid request: body.count",
    }


def test_unknown_route_uses_error_envelope() -> None:
    response = build_client(RuntimeError()).get("/missing")

    assert response.status_code == 404
    assert response.json() == {"code": "not_found", "message": "Not Found"}


@pytest.mark.parametrize(
    ("error", "level", "event"),
    [
        (ModelFailure("HTTP 500"), "warning", "domain_failure"),
        (DomainError("unmapped"), "error", "unmapped_domain_error"),
        (RuntimeError("boom"), "error", "unexpected_error"),
    ],
)
def test_server_failures_are_logged_through_port(error: Exception, level: str, event: str) -> None:
    logger = RecordingLogger()

    build_client(error, logger).get("/fail")

    [(logged_level, logged_event, _, fields)] = logger.records
    assert (logged_level, logged_event, fields["path"]) == (level, event, "/fail")


def test_unexpected_error_passes_exception_to_logger() -> None:
    error = RuntimeError("boom")
    logger = RecordingLogger()

    build_client(error, logger).get("/fail")

    assert logger.records[0][2] is error


def test_client_errors_are_not_logged() -> None:
    logger = RecordingLogger()

    build_client(InvalidQuery("bad"), logger).get("/fail")

    assert logger.records == []
