from functools import lru_cache
from pathlib import Path
from threading import Lock
from time import monotonic

import httpx


class TerrainSourceCache:
    def __init__(self, client: httpx.Client, cache_dir: Path | None = None) -> None:
        self._client = client
        self._directory = cache_dir
        self._locks = tuple(Lock() for _ in range(32))
        self._read = lru_cache(maxsize=128)(self._download)
        self._missing: dict[str, float] = {}
        if cache_dir is not None:
            cache_dir.mkdir(parents=True, exist_ok=True)

    def get(self, url: str, z: int, x: int, y: int) -> bytes:
        key = f"{z}-{x}-{y}"
        with self._locks[hash(key) % len(self._locks)]:
            if self._missing.get(key, 0) > monotonic():
                response = httpx.Response(404, request=httpx.Request("GET", url))
                response.raise_for_status()
            try:
                return self._read(url, key)
            except httpx.HTTPStatusError as error:
                if error.response.status_code == 404:
                    self._missing[key] = monotonic() + 300
                    if len(self._missing) > 512:
                        self._missing = {
                            tile: until
                            for tile, until in self._missing.items()
                            if until > monotonic()
                        }
                        if len(self._missing) > 512:
                            self._missing.pop(next(iter(self._missing)))
                raise

    def close(self) -> None:
        self._read.cache_clear()

    def _download(self, url: str, key: str) -> bytes:
        path = self._directory / f"{key}.webp" if self._directory else None
        if path is not None and path.is_file():
            return path.read_bytes()
        response = self._fetch(url)
        response.raise_for_status()
        if path is not None:
            temporary = path.with_suffix(".tmp")
            temporary.write_bytes(response.content)
            temporary.replace(path)
        return response.content

    def _fetch(self, url: str) -> httpx.Response:
        try:
            return self._client.get(url)
        except httpx.TransportError:
            return self._client.get(url)
