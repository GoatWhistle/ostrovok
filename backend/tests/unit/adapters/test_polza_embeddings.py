import base64
import json
import struct

import httpx
import pytest

from hotel_agent.adapters.semantic.polza import MODEL, PolzaEmbeddings


async def test_embedding_batches_reorder_vectors_by_input_index() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert request.url.path == "/api/v1/embeddings"
        assert payload["model"] == MODEL
        assert payload["input"] == ["первый", "второй"]
        return httpx.Response(
            200,
            json={
                "data": [
                    {"index": 1, "embedding": [0.0, 1.0]},
                    {"index": 0, "embedding": [1.0, 0.0]},
                ]
            },
        )

    embedder = PolzaEmbeddings("test", transport=httpx.MockTransport(respond))
    try:
        assert await embedder.embed(["первый", "второй"]) == [[1.0, 0.0], [0.0, 1.0]]
    finally:
        await embedder.aclose()


async def test_missing_vector_is_rejected() -> None:
    embedder = PolzaEmbeddings(
        "test",
        transport=httpx.MockTransport(
            lambda _: httpx.Response(200, json={"data": [{"index": 1, "embedding": [1.0]}]})
        ),
    )
    try:
        with pytest.raises(ValueError, match="missing or duplicate"):
            await embedder.embed(["один текст"])
    finally:
        await embedder.aclose()


async def test_base64_vectors_are_decoded_and_queries_receive_instructions() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content)
        assert payload["encoding_format"] == "base64"
        assert payload["input"][0].startswith("Instruct:")
        encoded = base64.b64encode(struct.pack("<ff", 1.0, -0.5)).decode()
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": encoded}]})

    embedder = PolzaEmbeddings("test", transport=httpx.MockTransport(respond))
    try:
        assert await embedder.embed(["номер под водой"], query=True) == [[1.0, -0.5]]
    finally:
        await embedder.aclose()
