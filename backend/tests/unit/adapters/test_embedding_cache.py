from collections.abc import Sequence

from hotel_agent.adapters.semantic.embedding_cache import CachedEmbeddings


class CountingEmbeddings:
    def __init__(self) -> None:
        self.batches: list[list[str]] = []

    async def embed(self, texts: Sequence[str], query: bool = False) -> Sequence[Sequence[float]]:
        self.batches.append(list(texts))
        return [[float(len(text)), 1.0 if query else 0.0] for text in texts]


async def test_a_repeated_query_is_embedded_once() -> None:
    inner = CountingEmbeddings()
    cache = CachedEmbeddings(inner)

    first = await cache.embed(["у моря"], query=True)
    second = await cache.embed(["у моря"], query=True)

    assert first == second
    assert inner.batches == [["у моря"]]


async def test_only_the_unseen_texts_are_sent() -> None:
    inner = CountingEmbeddings()
    cache = CachedEmbeddings(inner)

    await cache.embed(["a", "bb"])
    result = await cache.embed(["bb", "ccc", "a"])

    assert inner.batches == [["a", "bb"], ["ccc"]]
    assert result == [[2.0, 0.0], [3.0, 0.0], [1.0, 0.0]]


async def test_a_query_and_a_document_with_the_same_text_are_different_entries() -> None:
    inner = CountingEmbeddings()
    cache = CachedEmbeddings(inner)

    await cache.embed(["море"], query=True)
    await cache.embed(["море"])

    assert inner.batches == [["море"], ["море"]]


async def test_the_cache_drops_the_least_recently_used_vector() -> None:
    inner = CountingEmbeddings()
    cache = CachedEmbeddings(inner, capacity=2)

    await cache.embed(["a"])
    await cache.embed(["bb"])
    await cache.embed(["a"])
    await cache.embed(["ccc"])
    await cache.embed(["bb"])

    assert inner.batches == [["a"], ["bb"], ["ccc"], ["bb"]]
