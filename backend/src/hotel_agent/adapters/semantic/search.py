import asyncio
from collections.abc import Sequence

import httpx

from hotel_agent.adapters.semantic.index import DocumentIndex
from hotel_agent.application.ports.embeddings import EmbeddingsPort
from hotel_agent.application.ports.log import LoggerPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.semantic_search import SearchDocument


class SemanticSearch:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        index: DocumentIndex,
        embedder: EmbeddingsPort | None = None,
        logger: LoggerPort | None = None,
    ) -> None:
        self._uow, self._index, self._embedder = uow, index, embedder
        self._logger = logger
        self._queries: dict[str, Sequence[float]] = {}

    async def search(
        self, query: str, hotel_ids: Sequence[str] | None = None, limit: int = 100
    ) -> Sequence[SearchDocument]:
        async with self._uow() as uow:
            documents = await uow.documents.list(hotel_ids)
        vector = self._queries.get(query)
        if vector is None and self._index.ready and self._embedder:
            try:
                vector = (await self._embedder.embed([query], query=True))[0]
                if len(self._queries) >= 128:
                    self._queries.pop(next(iter(self._queries)))
                self._queries[query] = vector
            except (httpx.HTTPError, ValueError, RuntimeError) as error:
                if self._logger:
                    self._logger.warning(
                        "semantic_embedding_unavailable", cause=type(error).__name__
                    )
        hits = await asyncio.to_thread(self._index.rank, query, documents, min(limit, 500), vector)
        if self._logger:
            self._logger.info(
                "semantic_retrieval",
                mode="embedding" if vector else "lexical",
                document_count=len(documents),
                hit_count=len(hits),
                global_scope=hotel_ids is None,
            )
        return hits
