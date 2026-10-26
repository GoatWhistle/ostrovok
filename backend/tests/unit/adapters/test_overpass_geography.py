from pathlib import Path

import httpx
import pytest

from hotel_agent.adapters.external.overpass_geography import OverpassGeography

EXTRACT = Path(__file__).resolve().parents[2] / "fixtures/geography.osm"
BBOX = (10.0, 50.0, 10.005, 50.005)


async def test_free_source_reads_real_osm_format_without_credentials() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert "authorization" not in request.headers
        assert request.method == "POST"
        assert "50.0000000" in request.content.decode()
        return httpx.Response(200, content=EXTRACT.read_bytes())

    source = OverpassGeography("https://example.test/api", httpx.MockTransport(respond))
    try:
        result = await source.fetch(BBOX)
        assert result is not None and result.complete
        assert len(result.layers.buildings) == 2
    finally:
        await source.aclose()


@pytest.mark.parametrize("status", [403, 406, 429, 503, 504])
async def test_refusal_cools_down_all_boxes_without_retries(status: int) -> None:
    calls = []

    def respond(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(status, headers={"Retry-After": "600"})

    source = OverpassGeography("https://example.test/api", httpx.MockTransport(respond))
    try:
        assert await source.fetch(BBOX) is None
        assert await source.fetch((11.0, 50.0, 11.005, 50.005)) is None
        assert len(calls) == 1
    finally:
        await source.aclose()


@pytest.mark.parametrize(
    "payload", [b"broken XML", b"<html/>", b"<osm><remark>timeout</remark></osm>"]
)
async def test_malformed_or_partial_payload_is_unavailable(payload: bytes) -> None:
    source = OverpassGeography(
        "https://example.test/api",
        httpx.MockTransport(lambda _: httpx.Response(200, content=payload)),
    )
    try:
        assert await source.fetch(BBOX) is None
    finally:
        await source.aclose()
