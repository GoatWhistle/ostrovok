import json

import httpx
import pytest

from hotel_agent.domain.errors import ModelFailure

from .conftest import AnthropicBuild, RecordingLogger, message


@pytest.mark.parametrize("status", [400, 401, 403, 429, 500, 529])
async def test_http_errors_become_model_failures_without_leaking_secrets(
    anthropic_build: AnthropicBuild, anthropic_requests: list[httpx.Request], status: int
) -> None:
    llm = anthropic_build(lambda request: httpx.Response(status, text="test-secret"))
    try:
        with pytest.raises(ModelFailure, match=f"HTTP {status}") as error:
            await llm.contextualize_query("отель", "море")
        assert "test-secret" not in str(error.value)
        assert len(anthropic_requests) == 1
    finally:
        await llm.aclose()


@pytest.mark.parametrize("status", [401, 429])
async def test_authentication_and_rate_limit_errors_do_not_switch_models(
    anthropic_build: AnthropicBuild, anthropic_requests: list[httpx.Request], status: int
) -> None:
    llm = anthropic_build(lambda request: httpx.Response(status), fallback_model="claude-haiku-4-5")
    try:
        with pytest.raises(ModelFailure, match=f"HTTP {status}"):
            await llm.contextualize_query("отель", "море")
        assert len(anthropic_requests) == 1
    finally:
        await llm.aclose()


@pytest.mark.parametrize("failure", ["timeout", "connection", "overloaded"])
async def test_transient_errors_use_the_configured_fallback(
    anthropic_build: AnthropicBuild,
    anthropic_requests: list[httpx.Request],
    anthropic_logger: RecordingLogger,
    failure: str,
) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if len(anthropic_requests) == 1:
            if failure == "timeout":
                raise httpx.ReadTimeout("timeout", request=request)
            if failure == "connection":
                raise httpx.ConnectError("connection", request=request)
            return httpx.Response(529)
        return message("отель у моря")

    llm = anthropic_build(handle, fallback_model="claude-haiku-4-5")
    try:
        assert await llm.contextualize_query("отель", "море") == "отель у моря"
        assert [json.loads(request.content)["model"] for request in anthropic_requests] == [
            "claude-sonnet-4-6",
            "claude-haiku-4-5",
        ]
        assert anthropic_requests[0].extensions["timeout"]["read"] == 12
        assert anthropic_requests[1].extensions["timeout"]["read"] == 30
        assert anthropic_logger.events == ["llm_request_retry"]
    finally:
        await llm.aclose()


@pytest.mark.parametrize("recover", [True, False])
async def test_network_errors_retry_once_without_a_fallback(
    anthropic_build: AnthropicBuild,
    anthropic_requests: list[httpx.Request],
    recover: bool,
) -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        if not recover or len(anthropic_requests) == 1:
            raise httpx.ReadTimeout("test-secret", request=request)
        return message("отель у моря")

    llm = anthropic_build(handle)
    try:
        if recover:
            assert await llm.contextualize_query("отель", "море") == "отель у моря"
        else:
            with pytest.raises(ModelFailure, match="unreachable: ReadTimeout"):
                await llm.contextualize_query("отель", "море")
        assert len(anthropic_requests) == 2
        assert all(
            json.loads(request.content)["model"] == "claude-sonnet-4-6"
            for request in anthropic_requests
        )
    finally:
        await llm.aclose()


@pytest.mark.parametrize(
    "body",
    [
        [],
        {},
        {"stop_reason": "max_tokens", "content": [{"type": "text", "text": "partial"}]},
        {"stop_reason": "refusal", "content": [{"type": "text", "text": "refused"}]},
        {"stop_reason": "end_turn", "stop_details": {"type": "refusal"}, "content": []},
        {"stop_reason": "end_turn", "content": []},
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": "  "}]},
        {"stop_reason": "end_turn", "content": [{"type": "text", "text": None}]},
        {"stop_reason": "end_turn", "content": [None]},
        {"stop_reason": "end_turn", "content": [{"type": "thinking", "thinking": "private"}]},
    ],
)
async def test_malformed_refused_and_truncated_answers_fail(
    anthropic_build: AnthropicBuild, body: object
) -> None:
    llm = anthropic_build(lambda request: httpx.Response(200, json=body))
    try:
        with pytest.raises(ModelFailure):
            await llm.contextualize_query("отель", "море")
    finally:
        await llm.aclose()


async def test_invalid_http_json_becomes_a_model_failure(anthropic_build: AnthropicBuild) -> None:
    llm = anthropic_build(lambda request: httpx.Response(200, text="not json"))
    try:
        with pytest.raises(ModelFailure, match="invalid JSON response"):
            await llm.contextualize_query("отель", "море")
    finally:
        await llm.aclose()


async def test_text_blocks_are_joined_and_custom_endpoint_is_respected(
    anthropic_build: AnthropicBuild, anthropic_requests: list[httpx.Request]
) -> None:
    llm = anthropic_build(
        lambda request: httpx.Response(
            200,
            json={
                "stop_reason": "end_turn",
                "content": [
                    {"type": "thinking", "thinking": "private"},
                    {"type": "text", "text": "отель "},
                    {"type": "text", "text": "у моря"},
                ],
            },
        ),
        base_url="https://proxy.example/anthropic/v1/",
    )
    assert await llm.contextualize_query("отель", "море") == "отель у моря"
    assert str(anthropic_requests[0].url) == "https://proxy.example/anthropic/v1/messages"
    await llm.aclose()
    with pytest.raises(RuntimeError, match="client has been closed"):
        await llm.contextualize_query("отель", "горы")
