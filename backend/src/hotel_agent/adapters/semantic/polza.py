import asyncio
import base64
import math
from collections.abc import Sequence

import httpx
import numpy as np

MODEL = "qwen/qwen3-embedding-8b"


class PolzaEmbeddings:
    def __init__(
        self,
        api_key: str,
        model: str = MODEL,
        base_url: str = "https://polza.ai/api/v1",
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.model = model
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/") + "/",
            headers={"Authorization": "Bearer " + api_key},
            timeout=90,
            transport=transport,
        )

    async def embed(self, texts: Sequence[str], query: bool = False) -> Sequence[Sequence[float]]:
        inputs = [
            f"Instruct: Retrieve hotel records providing evidence for the requested wishes.\nQuery: {text}"
            if query
            else text
            for text in texts
        ]
        for attempt in range(5):
            try:
                response = await self._client.post(
                    "embeddings",
                    json={"model": self.model, "input": inputs, "encoding_format": "base64"},
                )
                if response.status_code in {429, 500, 502, 503, 504} and attempt < 4:
                    await asyncio.sleep(min(2**attempt, 8))
                    continue
                response.raise_for_status()
                data = response.json()["data"]
                rows = sorted(data, key=lambda row: row["index"])
                if [row["index"] for row in rows] != list(range(len(inputs))):
                    raise ValueError("Embedding response has missing or duplicate input indices")
                vectors = [
                    np.frombuffer(
                        base64.b64decode(row["embedding"], validate=True), dtype="<f4"
                    ).tolist()
                    if isinstance(row["embedding"], str)
                    else row["embedding"]
                    for row in rows
                ]
                if vectors and (
                    not vectors[0]
                    or any(
                        len(v) != len(vectors[0]) or not all(math.isfinite(x) for x in v)
                        for v in vectors
                    )
                ):
                    raise ValueError("Embedding response has invalid vectors")
                return vectors
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt == 4:
                    raise
                await asyncio.sleep(min(2**attempt, 8))
        raise RuntimeError("Embedding retry limit exceeded")

    async def aclose(self) -> None:
        await self._client.aclose()
