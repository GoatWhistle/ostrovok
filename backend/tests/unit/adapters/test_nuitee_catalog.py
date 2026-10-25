import httpx
import pytest

from hotel_agent.adapters.external.nuitee_catalog import NuiteeCatalog


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
