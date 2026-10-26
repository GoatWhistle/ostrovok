import json
from pathlib import Path
from typing import cast
from unittest.mock import AsyncMock

import numpy as np

from hotel_agent.adapters.semantic.batch_index import build_batches
from hotel_agent.adapters.semantic.index import MODEL, DocumentIndex, chunks, digest
from hotel_agent.application.ports.embeddings import EmbeddingsPort
from hotel_agent.application.ports.semantic_search import SearchDocument


def document(identifier: str, text: str) -> SearchDocument:
    return SearchDocument(id=identifier, hotel_id=identifier, text=text, source="catalog")


def test_dense_retrieval_finds_synonym_without_literal_word_overlap(tmp_path: Path) -> None:
    documents = [document("a", "underwater sleeping suite"), document("b", "swimming pool")]
    pieces = chunks(documents)
    np.savez_compressed(
        tmp_path / "index.npz", vectors=np.asarray([[1, 0], [0, 1]], dtype=np.float32)
    )
    (tmp_path / "metadata.json").write_text(
        json.dumps(
            {
                "model": MODEL,
                "ids": [d.id for d in pieces],
                "hashes": [digest(d.text) for d in pieces],
            }
        )
    )

    results = DocumentIndex(tmp_path).rank("номер под водой", documents, 2, [1, 0])

    assert results[0].hotel_id == "a"
    assert results[0].source == "catalog"
    assert results[0].text == "underwater sleeping suite"


def test_stale_vector_is_not_used_for_changed_source_text(tmp_path: Path) -> None:
    original = document("a", "underwater sleeping suite")
    piece = chunks([original])[0]
    np.savez_compressed(tmp_path / "index.npz", vectors=np.asarray([[1, 0]], dtype=np.float32))
    (tmp_path / "metadata.json").write_text(
        json.dumps({"model": MODEL, "ids": [piece.id], "hashes": [digest(piece.text)]})
    )

    assert not DocumentIndex(tmp_path).rank("номер под водой", [document("a", "closed")], 2, [1, 0])


def test_missing_index_uses_lexical_retrieval_without_model(tmp_path: Path) -> None:
    documents = [document("a", "хаммам и сауна"), document("b", "парковка")]

    results = DocumentIndex(tmp_path).rank("сауна", documents, 3)

    assert [d.hotel_id for d in results] == ["a"]


def test_corrupt_metadata_does_not_break_search_startup(tmp_path: Path) -> None:
    (tmp_path / "metadata.json").write_text("{broken")

    assert not DocumentIndex(tmp_path).ready


async def test_batch_index_resumes_and_preserves_alignment(tmp_path: Path) -> None:
    async def embed(texts: list[str]) -> list[list[float]]:
        return [[float(text.removeprefix("text-") or 0) + 1, 1.0] for text in texts]

    embedder = AsyncMock()
    embedder.embed.side_effect = embed
    documents = [document(str(i), f"text-{i}") for i in range(5)]
    count = await build_batches(
        documents,
        tmp_path,
        cast(EmbeddingsPort, embedder),
        MODEL,
        batch_size=2,
        concurrency=2,
        progress=lambda _: None,
    )
    assert count == 5
    assert embedder.embed.await_count == 3
    assert DocumentIndex(tmp_path).rank("пожелание", documents, 1, [1, 0])[0].hotel_id == "4"
    embedder.reset_mock()

    await build_batches(
        documents,
        tmp_path,
        cast(EmbeddingsPort, embedder),
        MODEL,
        batch_size=2,
        concurrency=2,
        progress=lambda _: None,
    )

    embedder.embed.assert_not_awaited()
    assert json.loads((tmp_path / "progress.json").read_text())["status"] == "complete"


async def test_identical_source_text_is_embedded_once_for_all_hotels(tmp_path: Path) -> None:
    embedder = AsyncMock()
    embedder.embed.return_value = [[1.0, 0.0]]
    documents = [document(str(i), "общий текст") for i in range(5)]

    await build_batches(
        documents,
        tmp_path,
        cast(EmbeddingsPort, embedder),
        MODEL,
        batch_size=2,
        progress=lambda _: None,
    )

    embedder.embed.assert_awaited_once_with(["общий текст"])
    metadata = json.loads((tmp_path / "metadata.json").read_text())
    assert len(metadata["ids"]) == 5
    assert np.load(tmp_path / "index.npz")["vectors"].shape == (5, 2)


def test_exact_hotel_name_is_retrievable_without_treating_name_as_property_evidence(
    tmp_path: Path,
) -> None:
    named = SearchDocument(
        id="osm:h1",
        hotel_id="h1",
        text='{"tourism":"hotel"}',
        source="OSM",
        hotel_name="Shine",
        website="https://shine-hotel.ru/",
    )
    similar = SearchDocument(
        id="osm:h2",
        hotel_id="h2",
        text="hotel with swimming pool",
        source="OSM",
        hotel_name="Другой",
    )

    hits = DocumentIndex(tmp_path).rank("Shine House отель Сочи", [similar, named], 2)

    assert hits[0].hotel_id == "h1"
    assert hits[0].website == "https://shine-hotel.ru/"
    assert "Shine" not in hits[0].text
