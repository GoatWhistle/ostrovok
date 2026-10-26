import httpx
import pytest

from hotel_agent.adapters.external.nuitee_catalog import NuiteeCatalog
from hotel_agent.application.ports.hotel_discovery import CatalogProviderFailure


@pytest.mark.asyncio
async def test_nuitee_catalog_keeps_provider_room_capacity_and_amenities() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.params["hotelId"] == "lp552d8"
        assert request.url.params["language"] == "ru"
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "lp552d8",
                    "name": "City Park Hotel Sochi",
                    "facilities": [
                        {"name": "Бассейн"},
                        {"name": "Шведский стол"},
                        {"name": "Бассейн"},
                    ],
                    "hotelFacilities": ["Pool", "Buffet breakfast", "Pool"],
                    "rooms": [
                        {
                            "id": 5960101,
                            "roomName": "Номер с двуспальной кроватью",
                            "maxAdults": 2,
                            "maxOccupancy": 3,
                            "roomAmenities": [{"name": "Кондиционер"}],
                        }
                    ],
                }
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
        hotel = await NuiteeCatalog("sand_example", client).get_hotel("lp552d8")
    assert len(hotel.rooms) == 1
    assert hotel.rooms[0].max_adults == 2
    assert hotel.rooms[0].amenities == ("Кондиционер",)
    assert hotel.facilities_ru == ("Бассейн", "Шведский стол")
    assert hotel.facilities_en == ("Pool", "Buffet breakfast")


@pytest.mark.parametrize(
    "body",
    [
        [],
        {"data": []},
        {"data": None},
        {"data": {"id": "wrong", "name": "Hotel"}},
        {"data": {"id": "lp1", "name": None}},
    ],
)
async def test_invalid_details_become_a_typed_provider_failure(body: object) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=body))
    ) as client:
        with pytest.raises(CatalogProviderFailure):
            await NuiteeCatalog("test-key", client).get_hotel("lp1")


async def test_detail_identity_preserves_the_address_and_coordinates() -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={
                    "data": {
                        "id": "lp1",
                        "name": "Marins Park",
                        "country": "RU",
                        "address": "Morskaya 12",
                        "location": {"longitude": 39.72, "latitude": 43.58},
                    }
                },
            )
        )
    ) as client:
        hotel = await NuiteeCatalog("test-key", client).get_hotel("lp1")
    assert hotel.identity is not None
    assert hotel.identity.address == "Morskaya 12"
    assert hotel.identity.location == (39.72, 43.58)
