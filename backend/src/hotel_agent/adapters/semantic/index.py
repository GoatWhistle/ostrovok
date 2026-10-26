import hashlib
import json
import re
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path

import numpy as np

from hotel_agent.application.ports.semantic_search import SearchDocument

MODEL = "qwen/qwen3-embedding-8b"


def digest(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def chunks(documents: Sequence[SearchDocument]) -> list[SearchDocument]:
    return [
        replace(doc, id=f"{doc.id}#{offset}", text=doc.text[offset : offset + 1600])
        for doc in documents
        for offset in range(0, max(len(doc.text), 1), 1400)
    ]


def tokens(text: str) -> set[str]:
    return {word for word in re.findall(r"\w+", text.casefold()) if len(word) > 2}


class DocumentIndex:
    def __init__(self, directory: Path, model: str = MODEL) -> None:
        self.model = model
        self._rows: dict[str, int] = {}
        self._hashes: list[str] = []
        self._vectors = np.empty((0, 0), dtype=np.float32)
        try:
            metadata = json.loads((directory / "metadata.json").read_text())
            if metadata["model"] == model:
                matrix = np.load(directory / "index.npz", allow_pickle=False)["vectors"]
                if len(matrix) == len(metadata["ids"]) == len(metadata["hashes"]):
                    self._vectors = matrix
                    self._rows = {key: i for i, key in enumerate(metadata["ids"])}
                    self._hashes = metadata["hashes"]
        except (OSError, ValueError, KeyError):
            pass

    @property
    def ready(self) -> bool:
        return bool(self._rows)

    def rank(
        self,
        query: str,
        documents: Sequence[SearchDocument],
        limit: int,
        query_vector: Sequence[float] | None = None,
    ) -> list[SearchDocument]:
        pieces = chunks(documents)
        wanted = tokens(query)
        scores = [len(wanted & tokens(d.text)) / max(len(wanted), 1) * 0.2 for d in pieces]
        for i, doc in enumerate(pieces):
            name = tokens(doc.hotel_name or "")
            if name and name <= wanted:
                scores[i] += 2.0
        indexed = [
            (i, self._rows[d.id])
            for i, d in enumerate(pieces)
            if d.id in self._rows and digest(d.text) == self._hashes[self._rows[d.id]]
        ]
        if indexed and query_vector is not None:
            vector = np.asarray(query_vector, dtype=np.float32)
            norm = np.linalg.norm(vector)
            if norm > 0 and vector.shape == (self._vectors.shape[1],):
                dense = self._vectors[[row for _, row in indexed]] @ (vector / norm)
                for (i, _), value in zip(indexed, dense, strict=True):
                    scores[i] += float(value)
        ordered = sorted(range(len(pieces)), key=lambda i: (-scores[i], pieces[i].id))
        selected = [
            replace(pieces[i], relevance=round(scores[i], 6)) for i in ordered if scores[i] > 0
        ]
        return selected[:limit]
