import httpx


class WikidataPlaceLookup:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._client = httpx.AsyncClient(
            base_url="https://www.wikidata.org",
            timeout=5,
            headers={"User-Agent": "HotelAgentHackathon/0.1 (place lookup)"},
            trust_env=False,
            transport=transport,
        )

    async def coordinates(
        self, name: str, bbox: tuple[float, float, float, float]
    ) -> tuple[float, float] | None:
        try:
            search = await self._client.get(
                "/w/api.php",
                params={
                    "action": "wbsearchentities",
                    "search": name,
                    "language": "ru",
                    "format": "json",
                    "limit": 10,
                },
            )
            search.raise_for_status()
            ids = [item["id"] for item in search.json().get("search", []) if "id" in item]
            if not ids:
                return None
            entities = await self._client.get(
                "/w/api.php",
                params={
                    "action": "wbgetentities",
                    "ids": "|".join(ids),
                    "props": "claims",
                    "format": "json",
                },
            )
            entities.raise_for_status()
        except (httpx.HTTPError, ValueError, KeyError):
            return None
        records = entities.json().get("entities", {})
        for identifier in ids:
            for claim in records.get(identifier, {}).get("claims", {}).get("P625", []):
                position = claim.get("mainsnak", {}).get("datavalue", {}).get("value", {})
                lon, lat = position.get("longitude"), position.get("latitude")
                if (
                    isinstance(lon, int | float)
                    and isinstance(lat, int | float)
                    and bbox[0] <= lon <= bbox[2]
                    and bbox[1] <= lat <= bbox[3]
                ):
                    return float(lon), float(lat)
        return None

    async def aclose(self) -> None:
        await self._client.aclose()
