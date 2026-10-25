import asyncio
import hashlib
import json
import os
from collections import Counter
from collections.abc import Callable, Sequence
from pathlib import Path

import numpy as np

from hotel_agent.adapters.semantic.index import chunks, digest
from hotel_agent.application.ports.embeddings import EmbeddingsPort
from hotel_agent.application.ports.semantic_search import SearchDocument


async def build_batches(
    documents: Sequence[SearchDocument],
    directory: Path,
    embedder: EmbeddingsPort,
    model: str,
    batch_size: int = 64,
    concurrency: int = 8,
    progress: Callable[[str], None] = print,
) -> int:
    pieces = chunks(documents)
    batches = directory / "batches"
    batches.mkdir(parents=True, exist_ok=True)
    known: dict[str, np.ndarray[tuple[int, ...], np.dtype[np.float32]]] = {}
    for offset in range(0, len(pieces), batch_size):
        selected = pieces[offset : offset + batch_size]
        identity = json.dumps([model, [(d.id, digest(d.text)) for d in selected]])
        path = batches / (hashlib.sha256(identity.encode()).hexdigest() + ".npy")
        if path.is_file():
            for doc, vector in zip(selected, np.load(path, allow_pickle=False), strict=True):
                known[digest(doc.text)] = vector
    for path in batches.glob("text-*.json"):
        manifest = json.loads(path.read_text())
        if manifest["model"] == model:
            for key, vector in zip(
                manifest["hashes"],
                np.load(path.with_suffix(".npy"), allow_pickle=False),
                strict=True,
            ):
                known[key] = vector
    unique = {digest(doc.text): doc.text for doc in pieces}
    missing = [(key, text) for key, text in unique.items() if key not in known]
    counts = Counter(digest(doc.text) for doc in pieces)
    gate = asyncio.Semaphore(concurrency)
    completed = sum(counts[key] for key in known)
    progress(
        f"resumed_chunks={completed}/{len(pieces)} unique_texts={len(unique)} missing_unique={len(missing)}"
    )

    def save_progress(status: str, dimensions: int | None = None) -> None:
        payload = {
            "model": model,
            "completed": completed,
            "total": len(pieces),
            "hotels": len({d.hotel_id for d in documents}),
            "unique_texts": len(unique),
            "embedded_unique": len(known),
            "status": status,
            "dimensions": dimensions,
        }
        (directory / "progress.tmp.json").write_text(json.dumps(payload))
        os.replace(directory / "progress.tmp.json", directory / "progress.json")

    async def run(offset: int) -> None:
        nonlocal completed
        selected = missing[offset : offset + batch_size]
        async with gate:
            vectors = np.asarray(
                await embedder.embed([text for _, text in selected]), dtype=np.float32
            )
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            if not np.all(norms > 0):
                raise ValueError("Embedding vectors must have positive norms")
            vectors = vectors / norms
            hashes = [key for key, _ in selected]
            identity = json.dumps([model, hashes])
            path = batches / ("text-" + hashlib.sha256(identity.encode()).hexdigest())
            np.save(path.with_suffix(".tmp.npy"), vectors)
            os.replace(path.with_suffix(".tmp.npy"), path.with_suffix(".npy"))
            path.with_suffix(".tmp.json").write_text(json.dumps({"model": model, "hashes": hashes}))
            os.replace(path.with_suffix(".tmp.json"), path.with_suffix(".json"))
            for (key, _), vector in zip(selected, vectors, strict=True):
                known[key] = vector
                completed += counts[key]
            progress(f"embedded={completed}/{len(pieces)} unique={len(known)}/{len(unique)}")
            save_progress("running")

    save_progress("running")
    await asyncio.gather(*(run(offset) for offset in range(0, len(missing), batch_size)))
    vectors = np.stack([known[digest(doc.text)] for doc in pieces])
    np.savez_compressed(directory / "index.tmp.npz", vectors=vectors)
    metadata = {
        "model": model,
        "ids": [d.id for d in pieces],
        "hashes": [digest(d.text) for d in pieces],
        "dimensions": vectors.shape[1],
    }
    (directory / "metadata.tmp.json").write_text(json.dumps(metadata))
    os.replace(directory / "index.tmp.npz", directory / "index.npz")
    os.replace(directory / "metadata.tmp.json", directory / "metadata.json")
    save_progress("complete", vectors.shape[1])
    return completed
