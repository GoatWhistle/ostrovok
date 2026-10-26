import json

import httpx
import pytest

from hotel_agent.adapters.external.nuitee_discovery import NuiteeDiscovery
from hotel_agent.application.ports.hotel_discovery import CatalogProviderFailure


def hotel(identifier: str = "hotel-1") -> dict[str, object]:
    return {
        "id": identifier,
        "name": "Marins Park Hotel",
        "country": "RU",
        "address": "Morskaya 12",
        "longitude": 39.72,
        "latitude": 43.58,
    }


async def test_coordinates_and_pagination_fetch_every_candidate() -> None:
    requests = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        assert request.headers["X-API-Key"] == "test-key"
        assert request.url.params["countryCode"] == "RU"
        assert request.url.params["radius"] == "1000"
        assert request.url.params["longitude"] == "39.72"
        assert request.url.params["latitude"] == "43.58"
        assert "hotelName" not in request.url.params
        return httpx.Response(200, json={"data": [hotel(str(len(requests)))], "total": 2})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        result = await NuiteeDiscovery("test-key", client, page_size=1).nearby((39.72, 43.58))
    assert result.complete
    assert [candidate.supplier_id for candidate in result.candidates] == ["1", "2"]
    assert [request.url.params["offset"] for request in requests] == ["0", "1"]


async def test_full_page_at_request_budget_is_incomplete() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"data": [hotel()], "total": 10})
        )
    ) as client:
        result = await NuiteeDiscovery("key", client, page_size=1, max_pages=1).nearby(
            (39.72, 43.58)
        )
    assert not result.complete


async def test_repeated_page_is_not_mistaken_for_exhausted_results() -> None:
    calls = 0

    def handle(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"data": [hotel()]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        result = await NuiteeDiscovery("key", client, page_size=1).nearby((39.72, 43.58))
    assert not result.complete
    assert calls == 2
    assert len(result.candidates) == 1


async def test_empty_catalog_is_a_complete_negative_result() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"data": []}))
    ) as client:
        result = await NuiteeDiscovery("key", client).nearby((39.72, 43.58))
    assert result.complete and result.candidates == ()


@pytest.mark.parametrize(
    "body",
    [
        [],
        {},
        {"data": None},
        {"error": {"code": 401}, "data": []},
        {"data": [None]},
        {"data": [{"id": "hotel"}]},
        {"data": [{**hotel(), "longitude": "39.72"}]},
        {"data": [{**hotel(), "latitude": True}]},
        {"data": [{**hotel(), "latitude": 91}]},
        {"data": [hotel()], "total": -1},
        {"data": [hotel()], "total": True},
    ],
)
async def test_malformed_candidates_fail_instead_of_disappearing(body: object) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, content=json.dumps(body)))
    ) as client:
        with pytest.raises(CatalogProviderFailure):
            await NuiteeDiscovery("key", client).nearby((39.72, 43.58))


@pytest.mark.parametrize("status", [401, 429, 500])
async def test_provider_errors_are_typed_without_key_disclosure(status: int) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status, text="secret-key"))
    ) as client:
        with pytest.raises(CatalogProviderFailure) as error:
            await NuiteeDiscovery("secret-key", client).nearby((39.72, 43.58))
        assert "secret-key" not in str(error.value)


async def test_network_timeout_is_a_provider_failure() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timeout", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        with pytest.raises(CatalogProviderFailure):
            await NuiteeDiscovery("key", client).nearby((39.72, 43.58))
