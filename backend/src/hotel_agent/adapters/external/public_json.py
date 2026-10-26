import asyncio
import json
from typing import Any

import httpx


async def public_json(
    client: httpx.AsyncClient, url: str, params: dict[str, str] | None = None
) -> dict[str, Any]:
    try:
        async with asyncio.timeout(10):
            async with client.stream("GET", url, params=params) as response:
                response.raise_for_status()
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > 2_000_000:
                        raise ValueError("Public data response exceeds the 2 MB limit")
                result = json.loads(body)
                if not isinstance(result, dict):
                    raise TypeError("Public data response must be a JSON object")
                return result
    except (httpx.HTTPError, TimeoutError, json.JSONDecodeError, RecursionError) as error:
        raise ValueError("Public data provider is unavailable or returned invalid JSON") from error
