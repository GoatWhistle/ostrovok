import httpx

from hotel_agent.adapters.external.wikidata_places import WikidataPlaceLookup


async def test_alias_is_selected_by_city_coordinates() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.params.get("action") == "wbsearchentities":
            return httpx.Response(200, json={"search": [{"id": "Q1"}, {"id": "Q4168756"}]})
        return httpx.Response(
            200,
            json={
                "entities": {
                    "Q1": {
                        "claims": {
                            "P625": [
                                {
                                    "mainsnak": {
                                        "datavalue": {
                                            "value": {"longitude": 30.0, "latitude": 60.0}
                                        }
                                    }
                                }
                            ]
                        }
                    },
                    "Q4168756": {
                        "claims": {
                            "P625": [
                                {
                                    "mainsnak": {
                                        "datavalue": {
                                            "value": {
                                                "longitude": 53.1969444,
                                                "latitude": 56.8519444,
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    },
                }
            },
        )

    lookup = WikidataPlaceLookup(httpx.MockTransport(respond))
    try:
        position = await lookup.coordinates("Монумент дружбы народов", (53.1, 56.7, 53.4, 57.0))
    finally:
        await lookup.aclose()

    assert position == (53.1969444, 56.8519444)
